#!/usr/bin/env python3
"""
Backfill visit_individuals with Goldrush IDs from visit_responses.
Uses batch SQL (multiple statements per API call) for speed.

Also fixes team_lead_id assignments on imported agents.
"""

import argparse, json, uuid, time, os, sys
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

CF_ACCOUNT_ID = os.environ["CF_ACCOUNT_ID"]
CF_DB_ID = os.environ["CF_DB_ID"]
CF_AUTH_EMAIL = os.environ["CF_AUTH_EMAIL"]
CF_AUTH_KEY = os.environ["CF_AUTH_KEY"]
D1_API_URL = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_DB_ID}/query"
D1_HEADERS = {"X-Auth-Email": CF_AUTH_EMAIL, "X-Auth-Key": CF_AUTH_KEY, "Content-Type": "application/json"}
TENANT_ID = "default-tenant-001"

def d1_query(sql):
    resp = requests.post(D1_API_URL, headers=D1_HEADERS, json={"sql": sql}, timeout=120)
    data = resp.json()
    if not data.get("success", False):
        raise Exception(f"D1 query failed: {data.get('errors', [])}")
    results = data.get("result", [])
    if results and len(results) > 0:
        return results[0].get("results", [])
    return []

def d1_batch(sql):
    """Execute multiple SQL statements in one API call (semicolon-separated)."""
    resp = requests.post(D1_API_URL, headers=D1_HEADERS, json={"sql": sql}, timeout=120)
    data = resp.json()
    if not data.get("success", False):
        raise Exception(f"D1 batch failed: {data.get('errors', [])}")
    return data

def esc(val):
    if val is None: return "NULL"
    if isinstance(val, (int, float)): return str(val)
    return "'" + str(val).replace("'", "''") + "'"

def extract_details(responses_json):
    if not responses_json: return {}
    try:
        resp = json.loads(responses_json) if isinstance(responses_json, str) else responses_json
    except (json.JSONDecodeError, TypeError):
        return {}
    cd = resp.get("consumerDetails", {})
    if cd:
        return {
            "name": (cd.get("consumerName") or "").strip(),
            "surname": (cd.get("consumerSurname") or "").strip(),
            "id_number": (cd.get("idPassportNumber") or "").strip(),
            "phone": (cd.get("cellphoneNumber") or "").strip(),
            "goldrush_id": (cd.get("goldrushId") or "").strip(),
        }
    return {
        "name": (resp.get("consumerName") or "").strip(),
        "surname": (resp.get("consumerSurname") or "").strip(),
        "id_number": (resp.get("idPassportNumber") or "").strip(),
        "phone": (resp.get("cellphoneNumber") or "").strip(),
        "goldrush_id": (resp.get("goldrushId") or "").strip(),
    }

BATCH_SIZE = 50  # statements per API call

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["dry-run", "execute"], default="dry-run")
    args = parser.parse_args()
    dry_run = args.mode == "dry-run"
    label = "DRY RUN" if dry_run else "EXECUTE"
    print(f"=== {label} MODE ===\n")

    # Step 1: Get visits needing visit_individuals
    print("Step 1: Fetching individual visits needing visit_individuals...")
    rows = d1_query(
        "SELECT v.id as visit_id, v.tenant_id, v.agent_id, v.company_id, "
        "v.individual_name, v.individual_surname, v.individual_id_number, v.individual_phone, "
        "v.visit_date, v.created_at, vr.responses "
        "FROM visits v "
        "JOIN visit_responses vr ON vr.visit_id = v.id "
        "LEFT JOIN visit_individuals vi ON vi.visit_id = v.id AND vi.tenant_id = v.tenant_id "
        "WHERE v.visit_type = 'individual' AND v.tenant_id = 'default-tenant-001' "
        "AND vi.id IS NULL ORDER BY v.visit_date"
    )
    print(f"  Found {len(rows)} visits needing VI records")

    # Step 1b: Get existing VI with empty custom_field_values
    print("\nStep 1b: Fetching existing VI with empty custom_field_values...")
    existing_vi_rows = d1_query(
        "SELECT vi.id as vi_id, vi.visit_id, vi.custom_field_values, vr.responses "
        "FROM visit_individuals vi "
        "JOIN visit_responses vr ON vr.visit_id = vi.visit_id "
        "JOIN visits v ON v.id = vi.visit_id "
        "WHERE v.visit_type = 'individual' AND vi.tenant_id = 'default-tenant-001' "
        "AND (vi.custom_field_values IS NULL OR vi.custom_field_values = '{}' OR vi.custom_field_values = '')"
    )
    print(f"  Found {len(existing_vi_rows)} existing VI needing goldrush_id")

    # Step 2: Load existing individuals for matching
    print("\nStep 2: Loading existing individuals...")
    all_ind = d1_query("SELECT id, first_name, last_name, id_number FROM individuals WHERE tenant_id = 'default-tenant-001'")
    lookup = {}
    for ind in all_ind:
        fn = (ind.get("first_name") or "").strip().lower()
        ln = (ind.get("last_name") or "").strip().lower()
        if (fn, ln) not in lookup: lookup[(fn, ln)] = ind["id"]
        if ind.get("id_number"): lookup[("id", ind["id_number"].strip())] = ind["id"]
    print(f"  Loaded {len(all_ind)} individuals")

    # Step 3: Build all SQL statements
    print(f"\nStep 3: Building SQL statements for {len(rows)} visits...")
    ind_inserts = []
    vi_inserts = []
    visit_updates = []
    stats = {"vi": 0, "ind_created": 0, "ind_matched": 0, "with_gr": 0, "no_gr": 0, "names": 0, "vi_updated": 0, "errors": 0}

    for row in rows:
        vid = row["visit_id"]; tid = row["tenant_id"]
        d = extract_details(row.get("responses", ""))
        name, surname = d.get("name",""), d.get("surname","")
        id_num, phone, gr_id = d.get("id_number",""), d.get("phone",""), d.get("goldrush_id","")
        if gr_id: stats["with_gr"] += 1
        else: stats["no_gr"] += 1

        # Find or create individual
        ind_id = None
        if id_num: ind_id = lookup.get(("id", id_num))
        if not ind_id and name: ind_id = lookup.get((name.lower(), surname.lower() if surname else ""))
        if ind_id:
            stats["ind_matched"] += 1
        else:
            ind_id = str(uuid.uuid4())
            fn = name if name else "Unknown"
            ln = surname if surname else "Individual"
            ind_inserts.append(
                f"INSERT INTO individuals (id, tenant_id, first_name, last_name, id_number, phone, company_id, status, created_at, updated_at) "
                f"VALUES ({esc(ind_id)}, {esc(tid)}, {esc(fn)}, {esc(ln)}, {esc(id_num if id_num else None)}, "
                f"{esc(phone if phone else None)}, {esc(row.get('company_id'))}, 'active', {esc(row.get('created_at',''))}, {esc(row.get('created_at',''))})"
            )
            lookup[(fn.lower(), ln.lower())] = ind_id
            if id_num: lookup[("id", id_num)] = ind_id
            stats["ind_created"] += 1

        # Create visit_individuals record
        cfv = {"goldrush_id": gr_id} if gr_id else {}
        vi_id = str(uuid.uuid4())
        vi_inserts.append(
            f"INSERT INTO visit_individuals (id, tenant_id, visit_id, individual_id, custom_field_values, created_at) "
            f"VALUES ({esc(vi_id)}, {esc(tid)}, {esc(vid)}, {esc(ind_id)}, {esc(json.dumps(cfv))}, {esc(row.get('created_at',''))})"
        )
        stats["vi"] += 1

        # Update visit names if NULL
        if name and (not row.get("individual_name") or row.get("individual_name") == ""):
            visit_updates.append(
                f"UPDATE visits SET individual_name = {esc(name)}, individual_surname = {esc(surname)}, "
                f"individual_id_number = {esc(id_num)}, individual_phone = {esc(phone)} "
                f"WHERE id = {esc(vid)} AND tenant_id = {esc(tid)}"
            )
            stats["names"] += 1

    # Step 3b: Build update statements for existing VI
    vi_update_stmts = []
    for row in existing_vi_rows:
        d = extract_details(row.get("responses", ""))
        gr_id = d.get("goldrush_id", "")
        if gr_id:
            vi_update_stmts.append(
                f"UPDATE visit_individuals SET custom_field_values = {esc(json.dumps({'goldrush_id': gr_id}))} "
                f"WHERE id = {esc(row['vi_id'])}"
            )
            stats["vi_updated"] += 1

    all_stmts = ind_inserts + vi_inserts + visit_updates + vi_update_stmts
    print(f"  Built {len(all_stmts)} total statements:")
    print(f"    {len(ind_inserts)} individual INSERTs")
    print(f"    {len(vi_inserts)} visit_individuals INSERTs")
    print(f"    {len(visit_updates)} visit UPDATEs")
    print(f"    {len(vi_update_stmts)} existing VI UPDATEs")

    if dry_run:
        print(f"\n=== DRY RUN COMPLETE ===")
        for k, v in stats.items(): print(f"  {k}: {v}")
        return

    # Step 4: Execute in batches
    print(f"\nStep 4: Executing {len(all_stmts)} statements in batches of {BATCH_SIZE}...")
    total_batches = (len(all_stmts) + BATCH_SIZE - 1) // BATCH_SIZE
    success_count = 0
    error_count = 0

    for batch_num in range(total_batches):
        start = batch_num * BATCH_SIZE
        end = min(start + BATCH_SIZE, len(all_stmts))
        batch = all_stmts[start:end]
        batch_sql = "; ".join(batch)

        try:
            d1_batch(batch_sql)
            success_count += len(batch)
        except Exception as e:
            error_msg = str(e)[:200]
            print(f"  Batch {batch_num+1} FAILED ({start}-{end}): {error_msg}")
            # Try individual statements in failed batch
            for stmt in batch:
                try:
                    d1_query(stmt)
                    success_count += 1
                except Exception as e2:
                    error_count += 1
                    if error_count <= 5:
                        print(f"    Individual stmt failed: {str(e2)[:100]}")

        if (batch_num + 1) % 10 == 0 or batch_num == total_batches - 1:
            print(f"  Batch {batch_num+1}/{total_batches} done ({success_count} ok, {error_count} err)")
        time.sleep(0.2)  # Small rate limit

    stats["errors"] = error_count
    print(f"\n{'='*50}")
    print(f"RESULTS (EXECUTED):")
    print(f"{'='*50}")
    print(f"  Statements executed successfully: {success_count}")
    print(f"  Errors: {error_count}")
    for k, v in stats.items(): print(f"  {k}: {v}")

main()
