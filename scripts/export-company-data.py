#!/usr/bin/env python3
"""Export every row that belongs to one field company (default: Diplomat, code DP)
from the Fieldvibe D1 database into a multi-sheet Excel workbook.

Live D1 (needs a read-only Cloudflare API token with D1 read scope):

    export CLOUDFLARE_API_TOKEN=...
    python3 scripts/export-company-data.py                     # prod, company DP
    python3 scripts/export-company-data.py --db preview        # preview DB
    python3 scripts/export-company-data.py --company-code GR --out goldrush.xlsx

Offline, from a SQLite copy (e.g. `wrangler d1 export fieldvibe-db --remote --output dump.sql`
then `sqlite3 dump.db < dump.sql`):

    python3 scripts/export-company-data.py --sqlite dump.db

Scoping, per table (columns are read from the live schema):
  field_companies            id = company
  * with company_id          company_id = company
  * with visit_id            visit of the company
  customers                  visited by the company
  users                      agents/managers linked to the company
  * with agent_id/user_id    agent linked to the company
  * with customer_id         customer visited by the company
  process_flows / _steps     flows assigned to the company
Tables matching none of these are tenant-wide reference data and are skipped.
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import urllib.request

from openpyxl import Workbook

HERE = os.path.dirname(os.path.abspath(__file__))
WRANGLER = os.path.join(HERE, '..', 'workers-api', 'wrangler.toml')
PAGE = 2000
CELL_MAX = 32000  # Excel cell limit is 32767 chars
SECRET_COLS = {'password_hash', 'pin_hash', 'admin_viewable_password', 'token', 'token_hash', 'p256dh', 'auth'}


def d1_ids(env: str) -> tuple[str, str]:
    toml = open(WRANGLER).read()
    account = re.search(r'^account_id\s*=\s*"([^"]+)"', toml, re.M).group(1)
    section = toml.split('[env.preview]')[1] if env == 'preview' else toml.split('[env.preview]')[0]
    db = re.search(r'database_id\s*=\s*"([^"]+)"', section).group(1)
    return account, db


class D1:
    def __init__(self, account: str, db: str, token: str):
        self.url = f'https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query'
        self.token = token

    def query(self, sql: str, params: list | None = None) -> list[dict]:
        body = json.dumps({'sql': sql, 'params': params or []}).encode()
        req = urllib.request.Request(self.url, body, {
            'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.load(r)
        if not data.get('success'):
            raise RuntimeError(data.get('errors'))
        return data['result'][0]['results']


class Sqlite:
    def __init__(self, path: str):
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row

    def query(self, sql: str, params: list | None = None) -> list[dict]:
        return [dict(r) for r in self.conn.execute(sql, params or [])]


def scope(table: str, cols: set[str]) -> str | None:
    """WHERE clause selecting the company's rows; `?` is the company id."""
    visits = 'SELECT id FROM visits WHERE company_id = ?'
    agents = ('SELECT agent_id FROM agent_company_links WHERE company_id = ? '
              'UNION SELECT manager_id FROM manager_company_links WHERE company_id = ?')
    if table == 'field_companies':
        return 'id = ?'
    if 'company_id' in cols:
        return 'company_id = ?'
    if 'visit_id' in cols:
        return f'visit_id IN ({visits})'
    if table == 'customers':
        return f'id IN (SELECT customer_id FROM visits WHERE company_id = ?)'
    if table == 'users':
        return f'id IN ({agents})'
    if 'agent_id' in cols:
        return f'agent_id IN ({agents})'
    if 'user_id' in cols:
        return f'user_id IN ({agents})'
    if 'customer_id' in cols:
        return f'customer_id IN (SELECT customer_id FROM visits WHERE company_id = ?)'
    if table == 'process_flows':
        return 'id IN (SELECT process_flow_id FROM company_process_flows WHERE company_id = ?)'
    if table == 'process_flow_steps':
        return 'process_flow_id IN (SELECT process_flow_id FROM company_process_flows WHERE company_id = ?)'
    return None


def cell(v):
    if isinstance(v, str) and len(v) > CELL_MAX:
        return f'<{len(v)} chars omitted>'
    return v


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--company-code', default='DP')
    ap.add_argument('--db', choices=['prod', 'preview'], default='prod')
    ap.add_argument('--sqlite', help='read from a local SQLite file instead of live D1')
    ap.add_argument('--out')
    args = ap.parse_args()

    if args.sqlite:
        db = Sqlite(args.sqlite)
    else:
        token = os.environ.get('CLOUDFLARE_API_TOKEN')
        if not token:
            print('CLOUDFLARE_API_TOKEN is not set (or pass --sqlite)', file=sys.stderr)
            return 2
        db = D1(*d1_ids(args.db), token)

    company = db.query('SELECT id, name FROM field_companies WHERE code = ?', [args.company_code])
    if not company:
        print(f'no field company with code {args.company_code}', file=sys.stderr)
        return 1
    cid, cname = company[0]['id'], company[0]['name']
    out = args.out or f"{re.sub(r'[^a-z0-9]+', '-', cname.lower()).strip('-')}-export.xlsx"

    tables = [r['name'] for r in db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' "
        "AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name")]

    wb = Workbook()
    summary = wb.active
    summary.title = 'Summary'
    summary.append(['Company', cname, cid])
    summary.append([])
    summary.append(['Table', 'Rows', 'Scope'])

    for table in tables:
        cols = [r['name'] for r in db.query(f'PRAGMA table_info("{table}")') if r['name'] not in SECRET_COLS]
        where = scope(table, set(cols))
        if not where:
            continue
        nparams = where.count('?')
        rows, offset = [], 0
        while True:
            page = db.query(f'SELECT * FROM "{table}" WHERE {where} ORDER BY rowid LIMIT {PAGE} OFFSET {offset}',
                            [cid] * nparams)
            rows += page
            offset += PAGE
            if len(page) < PAGE:
                break
        summary.append([table, len(rows), where])
        print(f'{table}: {len(rows)}')
        if not rows:
            continue
        ws = wb.create_sheet(table[:31])
        ws.append(cols)
        for r in rows:
            ws.append([cell(r.get(c)) for c in cols])

    wb.save(out)
    print(f'wrote {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
