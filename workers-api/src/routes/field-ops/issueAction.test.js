import { describe, it, expect } from 'vitest';
import { resolveAction, ensureIssues, coachingNotesTarget, dedupCap } from './issues.js';

// resolveAction(type, callerRole, callerId, issue) -> { allowed, reason?, handler? }
const deficit = { polarity: 'deficit', owner_id: 'owner1', subject_id: 'subj1' };
const recognition = { polarity: 'recognition', owner_id: 'owner1', subject_id: 'subj1' };

describe('resolveAction', () => {
  const denied = [
    // unknown action type
    { name: 'unknown type rejected', args: ['bogus', 'admin', 'x', deficit], reason: 'Unknown action type: bogus' },
    // polarityOnly mismatch both directions
    { name: 'recognition action on a deficit issue rejected', args: ['recognition', 'manager', 'x', deficit], reason: 'only applies to recognition' },
    { name: 'deficit-only action on a recognition issue rejected', args: ['acknowledge', 'team_lead', 'owner1', recognition], reason: 'only applies to deficit' },
    // ownOnly: non-subject caller
    { name: 'commit by a non-subject caller rejected', args: ['commit', 'agent', 'someone_else', deficit], reason: "issue's subject" },
    // roles === 'owner': non-owner caller
    { name: 'acknowledge by a non-owner rejected', args: ['acknowledge', 'team_lead', 'someone_else', deficit], reason: "issue's current owner" },
    // plain role membership denied
    { name: 'note by a role not in the list rejected', args: ['note', 'agent', 'x', deficit], reason: 'not permitted for role agent' },
  ];

  const allowed = [
    // ownOnly: subject === caller
    { name: 'commit by the issue subject allowed', args: ['commit', 'agent', 'subj1', deficit] },
    // roles === 'owner': owner_id === caller
    { name: 'acknowledge by the owner allowed', args: ['acknowledge', 'team_lead', 'owner1', deficit] },
    { name: 'resolve by the owner allowed', args: ['resolve', 'manager', 'owner1', deficit] },
    // plain role membership allowed
    { name: 'note by a listed role allowed', args: ['note', 'manager', 'x', deficit] },
    // admin => general_manager expansion (mirror of requireRole): note lists 'admin', not 'general_manager'
    { name: 'admin-listed action allows general_manager via expansion', args: ['note', 'general_manager', 'x', deficit] },
  ];

  denied.forEach(({ name, args, reason }) => {
    it(`denies: ${name}`, () => {
      const r = resolveAction(...args);
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain(reason);
      expect(r.handler).toBeUndefined();
    });
  });

  allowed.forEach(({ name, args }) => {
    it(`allows: ${name}`, () => {
      const r = resolveAction(...args);
      expect(r.allowed).toBe(true);
      expect(typeof r.handler).toBe('function');
    });
  });
});

// Schema-sync guard: ensureIssues' CREATE TABLE must carry the polarity column (migration 0020)
// and the company-scoped live-uniqueness index (migration 0021). Capture the SQL via a stub.
describe('ensureIssues schema', () => {
  it('creates the issues table with polarity and the company-scoped live unique index', async () => {
    const sqls = [];
    const db = { prepare: (sql) => { sqls.push(sql); return { run: async () => {} }; } };
    await ensureIssues(db);
    const all = sqls.join('\n');
    expect(all).toContain('polarity');
    expect(all).toContain('idx_issues_live');
    expect(all).toContain("issues(tenant_id, subject_id, COALESCE(company_id,''), polarity)");
  });
});

describe('coachingNotesTarget', () => {
  it('pins field agent roles to their own log, ignoring the param', () => {
    for (const role of ['agent', 'field_agent', 'sales_rep']) {
      expect(coachingNotesTarget(role, 'me', 'someone-else')).toBe('me');
    }
  });
  it('lets supervising roles target any agent', () => {
    for (const role of ['team_lead', 'manager', 'general_manager', 'admin', 'backoffice_admin', 'super_admin']) {
      expect(coachingNotesTarget(role, 'me', 'someone-else')).toBe('someone-else');
    }
  });
  it('defaults to self when no agentId given', () => {
    expect(coachingNotesTarget('manager', 'me', undefined)).toBe('me');
  });
});

describe('dedupCap', () => {
  const row = (subject_id, kind, id, extra = {}) => ({ id, subject_id, kind, ...extra });
  it('keeps the first (worst) row per (subject_id, kind)', () => {
    const { issues, more } = dedupCap([row('a', 'gone_quiet', 1), row('a', 'gone_quiet', 2), row('a', 'low_conversion', 3)]);
    expect(issues.map((i) => i.id)).toEqual([1, 3]);
    expect(more).toBe(0);
  });
  it('caps at 10 and reports the overflow after dedup', () => {
    const rows = Array.from({ length: 14 }, (_, i) => row(`s${i}`, 'gone_quiet', i));
    const { issues, more } = dedupCap(rows);
    expect(issues).toHaveLength(10);
    expect(issues[0].id).toBe(0);
    expect(more).toBe(4);
  });
  it('groups the full deduped set by kind, worst-first, with the worst 3 per group', () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => row(`g${i}`, 'gone_quiet', `g${i}`, { breached: i < 2 })),
      row('h0', 'hit_gate_early', 'h0', { polarity: 'recognition' }),
      ...Array.from({ length: 8 }, (_, i) => row(`l${i}`, 'low_conversion', `l${i}`)),
    ];
    const { groups, more } = dedupCap(rows);
    expect(more).toBe(4); // grouping spans the overflow, not just the capped 10
    expect(groups.map((g) => g.kind)).toEqual(['gone_quiet', 'hit_gate_early', 'low_conversion']);
    const [gq, gate, lc] = groups;
    expect(gq).toMatchObject({ count: 5, breached: 2, polarity: 'deficit' });
    expect(gq.worst.map((i) => i.id)).toEqual(['g0', 'g1', 'g2']);
    expect(gate).toMatchObject({ count: 1, polarity: 'recognition' });
    expect(lc.count).toBe(8);
    expect(lc.worst).toHaveLength(3);
  });
  it('handles null/empty input', () => {
    expect(dedupCap(null)).toEqual({ issues: [], more: 0, groups: [] });
    expect(dedupCap([])).toEqual({ issues: [], more: 0, groups: [] });
  });
});
