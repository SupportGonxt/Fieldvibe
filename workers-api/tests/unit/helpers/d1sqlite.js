// Minimal D1-compatible adapter over node:sqlite (Node 22+/24). Lets route tests run
// real SQL so tenant isolation and the redemption flip are genuinely exercised, not faked.
// Exposes the subset of the D1 prepared-statement API our routes use:
//   db.prepare(sql).bind(...args).first() | .all() -> {results} | .run() -> {meta:{changes}}
import { DatabaseSync } from 'node:sqlite';

export function makeD1(schemaSql) {
  const sdb = new DatabaseSync(':memory:');
  if (schemaSql) sdb.exec(schemaSql);

  const exec = (sql, args) => {
    const stmt = sdb.prepare(sql);
    // node:sqlite rejects undefined; coerce to null to match D1's binding behaviour.
    const safe = args.map((a) => (a === undefined ? null : a));
    return { stmt, safe };
  };

  function statement(sql, boundArgs) {
    return {
      async first() {
        const { stmt, safe } = exec(sql, boundArgs);
        return stmt.get(...safe) ?? null;
      },
      async all() {
        const { stmt, safe } = exec(sql, boundArgs);
        return { results: stmt.all(...safe) };
      },
      async run() {
        const { stmt, safe } = exec(sql, boundArgs);
        const info = stmt.run(...safe);
        return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
      },
    };
  }

  return {
    _sdb: sdb,
    exec: (sql) => sdb.exec(sql),
    prepare(sql) {
      return {
        bind: (...args) => statement(sql, args),
        ...statement(sql, []),
      };
    },
  };
}
