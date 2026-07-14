import { describe, it, expect } from 'vitest';
import { seedKpiDefaults } from './config.js';

// Minimal in-memory program_config: enforces the real table's id PRIMARY KEY
// (the constraint the old fixed `pc-default-${key}` ids collided on across tenants)
// and answers the exists-check SELECT. INSERT OR IGNORE on a PK hit = silent no-op.
function fakeProgramConfig() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          if (sql.startsWith('SELECT')) {
            const [tenantId, key] = args;
            return {
              async first() {
                return rows.find((r) => r.tenant_id === tenantId && r.company_id === null && r.key === key) ?? null;
              },
            };
          }
          const [id, tenantId, key, valueJson] = args;
          return {
            async run() {
              if (rows.some((r) => r.id === id)) return; // PRIMARY KEY + OR IGNORE
              rows.push({ id, tenant_id: tenantId, company_id: null, key, value_json: valueJson });
            },
          };
        },
      };
    },
  };
}

const keysFor = (rows, tenantId) => rows.filter((r) => r.tenant_id === tenantId).map((r) => r.key).sort();

describe('seedKpiDefaults', () => {
  it('seeds KPI defaults for two different tenants (ids must not collide)', async () => {
    const db = fakeProgramConfig();
    await seedKpiDefaults(db, 'tenant-a');
    await seedKpiDefaults(db, 'tenant-b');
    const a = keysFor(db.rows, 'tenant-a');
    const b = keysFor(db.rows, 'tenant-b');
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a); // second tenant gets the full set, not silently nothing
    for (const k of a) expect(k).toMatch(/^kpi\./);
  });

  it('is idempotent per tenant on re-run', async () => {
    const db = fakeProgramConfig();
    await seedKpiDefaults(db, 'tenant-a');
    const before = db.rows.length;
    await seedKpiDefaults(db, 'tenant-a');
    expect(db.rows.length).toBe(before);
  });

  it('does not duplicate rows for tenants seeded with legacy non-tenant-scoped ids', async () => {
    const db = fakeProgramConfig();
    db.rows.push({ id: 'pc-default-kpi.agent', tenant_id: 'tenant-a', company_id: null, key: 'kpi.agent', value_json: '{"visits_per_day":99}' });
    await seedKpiDefaults(db, 'tenant-a');
    const agentRows = db.rows.filter((r) => r.tenant_id === 'tenant-a' && r.key === 'kpi.agent');
    expect(agentRows).toHaveLength(1);
    expect(agentRows[0].value_json).toContain('99'); // pre-existing (possibly edited) row wins
  });
});
