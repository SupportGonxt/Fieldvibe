import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// A general_manager could not log in because two accounts existed that differed only in
// the capitalisation of the email — `users.email` is `TEXT UNIQUE` with no COLLATE NOCASE,
// so SQLite treats them as distinct rows, and an exact `email = ?` match landed on the
// wrong one and failed the bcrypt compare with a bare "Invalid credentials". Every email
// lookup on a login/recovery path has to be case-insensitive, and the registration
// duplicate check too — that check is what let the second account be created at all.
const cases = [
  ['src/routes/auth.js', 'login',
   'SELECT * FROM users WHERE (LOWER(email) = LOWER(?) OR phone = ?) AND is_active = 1'],
  ['src/routes/auth.js', 'register duplicate check',
   'SELECT id FROM users WHERE LOWER(email) = LOWER(?)'],
  ['src/routes/auth.js', 'forgot password',
   'SELECT id, tenant_id, email, first_name FROM users WHERE LOWER(email) = LOWER(?) AND is_active = 1'],
  ['src/routes/companyPortal.js', 'company portal login',
   'WHERE LOWER(cl.email) = LOWER(?) AND cl.is_active = 1'],
];

describe('email lookups on auth paths are case-insensitive', () => {
  for (const [file, label, needle] of cases) {
    it(label, () => {
      const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
      expect(src, `${label}: ${file} lost its case-insensitive email lookup`).toContain(needle);
    });
  }

  // `portal_users` is deliberately exempt: it lowercases at write time (fieldOps.js
  // invite insert) and at read time, so an exact match there is already normalised.
  it('no users/company_logins lookup is left matching email exactly', () => {
    for (const file of ['src/routes/auth.js', 'src/routes/companyPortal.js']) {
      const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
      for (const line of src.split('\n')) {
        if (!/FROM users\b|company_logins/.test(line)) continue;
        expect(line, file).not.toMatch(/(?<!LOWER\()\b(cl\.)?email\s*=\s*\?/);
      }
    }
  });
});
