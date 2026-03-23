#!/usr/bin/env python3
"""
SalesSync → Fieldvibe Migration Script
Migrates Goldrush data from MySQL salessync to Cloudflare D1 Fieldvibe database.

Usage:
  python3 migrate_salessync_to_fieldvibe.py --mode test    # Create test tenant + import sample
  python3 migrate_salessync_to_fieldvibe.py --mode full    # Full import to Goldrush company
  python3 migrate_salessync_to_fieldvibe.py --mode dry-run # Show what would be imported
"""

import argparse
import json
import uuid
import sys
import time
import hashlib
from datetime import datetime

import os

import mysql.connector
import requests

# ── Config ──────────────────────────────────────────────────────────────────
# All secrets are read from environment variables.
# Set them before running:
#   export MYSQL_HOST=...
#   export MYSQL_PORT=3306
#   export MYSQL_USER=...
#   export MYSQL_PASSWORD=...
#   export MYSQL_DATABASE=salessync
#   export CF_ACCOUNT_ID=...
#   export CF_DB_ID=...
#   export CF_AUTH_EMAIL=...
#   export CF_AUTH_KEY=...

MYSQL_CONFIG = {
    "host": os.environ["MYSQL_HOST"],
    "port": int(os.environ.get("MYSQL_PORT", "3306")),
    "user": os.environ["MYSQL_USER"],
    "password": os.environ["MYSQL_PASSWORD"],
    "database": os.environ.get("MYSQL_DATABASE", "salessync"),
}

CF_ACCOUNT_ID = os.environ["CF_ACCOUNT_ID"]
CF_DB_ID = os.environ["CF_DB_ID"]
CF_AUTH_EMAIL = os.environ["CF_AUTH_EMAIL"]
CF_AUTH_KEY = os.environ["CF_AUTH_KEY"]

D1_API_URL = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_DB_ID}/query"
D1_HEADERS = {
    "X-Auth-Email": CF_AUTH_EMAIL,
    "X-Auth-Key": CF_AUTH_KEY,
    "Content-Type": "application/json",
}

# Existing Fieldvibe Goldrush company
GOLDRUSH_TENANT_ID = "default-tenant-001"
GOLDRUSH_COMPANY_ID = "abd43534-294b-4e8e-aea2-153e0773a924"

# Source company in salessync
SOURCE_COMPANY_ID = 1

# ── Helpers ─────────────────────────────────────────────────────────────────

def gen_uuid():
    return str(uuid.uuid4())

def d1_query(sql, params=None):
    """Execute a D1 SQL query via Cloudflare API."""
    body = {"sql": sql}
    if params:
        body["params"] = params
    resp = requests.post(D1_API_URL, headers=D1_HEADERS, json=body, timeout=30)
    data = resp.json()
    if not data.get("success", False):
        errors = data.get("errors", [])
        raise Exception(f"D1 query failed: {errors}\nSQL: {sql[:200]}")
    return data["result"][0] if data.get("result") else None

def d1_batch(statements):
    """Execute multiple D1 SQL statements in a batch. Max ~100 per batch."""
    # D1 API doesn't support true batching via REST, so we execute sequentially
    results = []
    for sql in statements:
        try:
            r = d1_query(sql)
            results.append(r)
        except Exception as e:
            print(f"  ERROR: {e}")
            results.append(None)
    return results

def escape_sql(val):
    """Escape a value for SQL insertion."""
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    s = str(val).replace("'", "''")
    return f"'{s}'"

def split_name(full_name):
    """Split a full name into first_name, last_name."""
    if not full_name:
        return ("Unknown", "Unknown")
    parts = full_name.strip().split(None, 1)
    first = parts[0] if len(parts) > 0 else "Unknown"
    last = parts[1] if len(parts) > 1 else ""
    return (first, last)

def normalize_phone(phone):
    """Normalize phone to +27 format if it looks like a SA number."""
    if not phone:
        return None
    phone = phone.strip()
    if phone.startswith("27") and len(phone) >= 11:
        return f"+{phone}"
    if phone.startswith("0") and len(phone) >= 10:
        return f"+27{phone[1:]}"
    return phone  # Leave as-is for dummy phones

def map_status(status):
    """Map salessync status to Fieldvibe status."""
    mapping = {
        "PENDING": "pending",
        "APPROVED": "approved",
        "FLAGGED": "flagged",
    }
    return mapping.get(status, "pending")

def map_role(role):
    """Map salessync role to Fieldvibe role."""
    mapping = {
        "admin": "admin",
        "manager": "manager",
        "team_lead": "team_lead",
        "agent": "agent",
    }
    return mapping.get(role, "agent")


# ── Data Extraction ─────────────────────────────────────────────────────────

def extract_mysql_data(limit=None):
    """Extract all Goldrush data from MySQL salessync."""
    print("Connecting to MySQL...")
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = conn.cursor(dictionary=True)

    data = {}

    # Users
    cursor.execute(
        "SELECT * FROM users WHERE company_id = %s ORDER BY id",
        (SOURCE_COMPANY_ID,)
    )
    data["users"] = cursor.fetchall()
    print(f"  Users: {len(data['users'])}")

    # Shops
    q = "SELECT * FROM shops WHERE company_id = %s ORDER BY id"
    if limit:
        q += f" LIMIT {limit}"
    cursor.execute(q, (SOURCE_COMPANY_ID,))
    data["shops"] = cursor.fetchall()
    print(f"  Shops: {len(data['shops'])}")

    # Checkins (visits)
    q = "SELECT id, agent_id, shop_id, timestamp, latitude, longitude, photo_path, notes, status, brand_id, category_id, product_id, company_id, LENGTH(photo_base64) as photo_b64_len, LENGTH(additional_photos_base64) as addl_photos_len FROM checkins WHERE company_id = %s ORDER BY id"
    if limit:
        q += f" LIMIT {limit}"
    cursor.execute(q, (SOURCE_COMPANY_ID,))
    data["checkins"] = cursor.fetchall()
    print(f"  Checkins: {len(data['checkins'])}")

    # Get checkin IDs for visit_responses
    checkin_ids = [c["id"] for c in data["checkins"]]

    # Visit responses
    if checkin_ids:
        # Batch the query for large datasets
        data["visit_responses"] = []
        batch_size = 500
        for i in range(0, len(checkin_ids), batch_size):
            batch = checkin_ids[i:i+batch_size]
            placeholders = ",".join(["%s"] * len(batch))
            cursor.execute(
                f"SELECT * FROM visit_responses WHERE checkin_id IN ({placeholders}) ORDER BY id",
                batch
            )
            data["visit_responses"].extend(cursor.fetchall())
    else:
        data["visit_responses"] = []
    print(f"  Visit Responses: {len(data['visit_responses'])}")

    # Questionnaires
    cursor.execute(
        "SELECT * FROM questionnaires WHERE company_id = %s ORDER BY id",
        (SOURCE_COMPANY_ID,)
    )
    data["questionnaires"] = cursor.fetchall()
    print(f"  Questionnaires: {len(data['questionnaires'])}")

    # Goals
    cursor.execute(
        "SELECT * FROM goals WHERE company_id = %s ORDER BY id",
        (SOURCE_COMPANY_ID,)
    )
    data["goals"] = cursor.fetchall()
    print(f"  Goals: {len(data['goals'])}")

    # Goal assignments
    cursor.execute(
        "SELECT ga.* FROM goal_assignments ga JOIN goals g ON ga.goal_id = g.id WHERE g.company_id = %s ORDER BY ga.id",
        (SOURCE_COMPANY_ID,)
    )
    data["goal_assignments"] = cursor.fetchall()
    print(f"  Goal Assignments: {len(data['goal_assignments'])}")

    # Brands
    cursor.execute(
        "SELECT * FROM brands WHERE company_id IS NULL OR company_id = %s",
        (SOURCE_COMPANY_ID,)
    )
    data["brands"] = cursor.fetchall()
    print(f"  Brands: {len(data['brands'])}")

    # Categories
    cursor.execute("SELECT * FROM categories")
    data["categories"] = cursor.fetchall()
    print(f"  Categories: {len(data['categories'])}")

    # Products
    cursor.execute("SELECT * FROM products")
    data["products"] = cursor.fetchall()
    print(f"  Products: {len(data['products'])}")

    cursor.close()
    conn.close()
    return data


def extract_photos_batch(checkin_ids, batch_size=50):
    """Extract photo base64 data for specific checkin IDs in batches."""
    if not checkin_ids:
        return {}

    conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = conn.cursor(dictionary=True)
    photos = {}

    for i in range(0, len(checkin_ids), batch_size):
        batch = checkin_ids[i:i+batch_size]
        placeholders = ",".join(["%s"] * len(batch))
        cursor.execute(
            f"SELECT id, photo_base64, additional_photos_base64 FROM checkins WHERE id IN ({placeholders}) AND (LENGTH(photo_base64) > 0 OR LENGTH(additional_photos_base64) > 0)",
            batch
        )
        for row in cursor.fetchall():
            photos[row["id"]] = {
                "photo_base64": row["photo_base64"],
                "additional_photos_base64": row["additional_photos_base64"],
            }
        print(f"  Extracted photos for batch {i//batch_size + 1}/{(len(checkin_ids) + batch_size - 1) // batch_size} ({len(photos)} total with photos)")

    cursor.close()
    conn.close()
    return photos


# ── ID Mapping ──────────────────────────────────────────────────────────────

class IDMapper:
    """Maps old integer IDs to new UUIDs."""

    def __init__(self):
        self.maps = {}  # table -> {old_id -> new_uuid}

    def add(self, table, old_id):
        if table not in self.maps:
            self.maps[table] = {}
        if old_id not in self.maps[table]:
            self.maps[table][old_id] = gen_uuid()
        return self.maps[table][old_id]

    def get(self, table, old_id):
        if old_id is None:
            return None
        return self.maps.get(table, {}).get(old_id)

    def dump(self):
        """Return all mappings for debugging."""
        return {t: {str(k): v for k, v in m.items()} for t, m in self.maps.items()}


# ── Data Transformation ─────────────────────────────────────────────────────

def transform_data(data, tenant_id, company_id, mapper):
    """Transform salessync data into Fieldvibe format."""
    transformed = {}

    # ── Users ───────────────────────────────────────────────────────────
    print("\nTransforming users...")
    users = []
    for u in data["users"]:
        new_id = mapper.add("users", u["id"])
        first_name, last_name = split_name(u["name"])
        phone = normalize_phone(u["phone"])
        email = f"migrated.{u['id']}@goldrush.salessync"
        role = map_role(u["role"])

        users.append({
            "id": new_id,
            "tenant_id": tenant_id,
            "email": email,
            "phone": phone,
            "password_hash": u.get("password_hash", "$2b$12$placeholder"),
            "first_name": first_name,
            "last_name": last_name,
            "role": role,
            "manager_id": None,  # Set in second pass
            "team_lead_id": None,  # Set in second pass
            "status": "active" if u.get("is_active") else "inactive",
            "is_active": 1 if u.get("is_active") else 0,
            "admin_viewable_password": u.get("admin_viewable_password"),
            "created_at": u["created_at"].isoformat() if u.get("created_at") else datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        })

    # Second pass: set manager_id and team_lead_id
    for i, u in enumerate(data["users"]):
        if u.get("manager_id"):
            users[i]["manager_id"] = mapper.get("users", u["manager_id"])
        if u.get("team_lead_id"):
            users[i]["team_lead_id"] = mapper.get("users", u["team_lead_id"])

    transformed["users"] = users
    print(f"  Transformed {len(users)} users")

    # ── Agent company assignments ───────────────────────────────────────
    print("\nTransforming agent company assignments...")
    assignments = []
    for u in data["users"]:
        if u["role"] in ("agent", "team_lead"):
            assignments.append({
                "id": gen_uuid(),
                "user_id": mapper.get("users", u["id"]),
                "tenant_id": tenant_id,
                "role_override": None,
                "granted_by": None,
                "granted_at": datetime.utcnow().isoformat(),
                "revoked_at": None,
            })
    transformed["agent_company_assignments"] = assignments
    print(f"  Transformed {len(assignments)} assignments")

    # ── Agent company links ─────────────────────────────────────────────
    print("\nTransforming agent company links...")
    agent_links = []
    for u in data["users"]:
        if u["role"] in ("agent", "team_lead"):
            agent_links.append({
                "id": gen_uuid(),
                "agent_id": mapper.get("users", u["id"]),
                "company_id": company_id,
                "tenant_id": tenant_id,
                "is_active": 1,
                "assigned_at": datetime.utcnow().isoformat(),
            })
    transformed["agent_company_links"] = agent_links
    print(f"  Transformed {len(agent_links)} agent-company links")

    # ── Manager company links ───────────────────────────────────────────
    print("\nTransforming manager company links...")
    manager_links = []
    for u in data["users"]:
        if u["role"] in ("manager", "admin"):
            manager_links.append({
                "id": gen_uuid(),
                "manager_id": mapper.get("users", u["id"]),
                "company_id": company_id,
                "tenant_id": tenant_id,
                "is_active": 1,
                "assigned_at": datetime.utcnow().isoformat(),
            })
    transformed["manager_company_links"] = manager_links
    print(f"  Transformed {len(manager_links)} manager-company links")

    # ── Brands ──────────────────────────────────────────────────────────
    print("\nTransforming brands...")
    brands = []
    for b in data["brands"]:
        new_id = mapper.add("brands", b["id"])
        brands.append({
            "id": new_id,
            "tenant_id": tenant_id,
            "name": b["name"],
            "code": b["name"].lower().replace(" ", "-"),
            "description": b.get("description", ""),
            "status": "active",
            "created_at": datetime.utcnow().isoformat(),
        })
    transformed["brands"] = brands
    print(f"  Transformed {len(brands)} brands")

    # ── Categories ──────────────────────────────────────────────────────
    print("\nTransforming categories...")
    categories = []
    for c in data["categories"]:
        new_id = mapper.add("categories", c["id"])
        categories.append({
            "id": new_id,
            "tenant_id": tenant_id,
            "brand_id": mapper.get("brands", c["brand_id"]),
            "name": c["name"],
            "code": c["name"].lower().replace(" ", "-"),
            "description": c.get("description", ""),
            "status": "active",
            "created_at": datetime.utcnow().isoformat(),
        })
    transformed["categories"] = categories
    print(f"  Transformed {len(categories)} categories")

    # ── Products ────────────────────────────────────────────────────────
    print("\nTransforming products...")
    products = []
    for p in data["products"]:
        new_id = mapper.add("products", p["id"])
        products.append({
            "id": new_id,
            "tenant_id": tenant_id,
            "name": p["name"],
            "code": p["name"].lower().replace(" ", "-"),
            "category_id": mapper.get("categories", p["category_id"]),
            "brand_id": mapper.get("brands", p.get("brand_id")),
            "status": "active",
            "created_at": datetime.utcnow().isoformat(),
        })
    transformed["products"] = products
    print(f"  Transformed {len(products)} products")

    # ── Shops → Customers ───────────────────────────────────────────────
    print("\nTransforming shops → customers...")
    customers = []
    for s in data["shops"]:
        new_id = mapper.add("shops", s["id"])
        customers.append({
            "id": new_id,
            "tenant_id": tenant_id,
            "name": s["name"],
            "type": "store",
            "customer_type": "store",
            "address": s.get("address", ""),
            "latitude": s.get("latitude"),
            "longitude": s.get("longitude"),
            "status": "active",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        })
    transformed["customers"] = customers
    print(f"  Transformed {len(customers)} customers (from shops)")

    # ── Build visit_response lookup ─────────────────────────────────────
    vr_by_checkin = {}
    for vr in data["visit_responses"]:
        vr_by_checkin[vr["checkin_id"]] = vr

    # ── Checkins → Visits ───────────────────────────────────────────────
    print("\nTransforming checkins → visits...")
    visits = []
    visit_responses = []
    individuals_map = {}  # (name, surname, id_number) -> uuid

    for c in data["checkins"]:
        new_id = mapper.add("checkins", c["id"])
        agent_uuid = mapper.get("users", c["agent_id"])
        customer_uuid = mapper.get("shops", c["shop_id"]) if c.get("shop_id") else None

        # Get visit response to determine type and extract individual data
        vr = vr_by_checkin.get(c["id"])
        visit_type = "store"
        individual_name = None
        individual_surname = None
        individual_id_number = None
        individual_phone = None
        responses_json = None

        if vr:
            vt = vr.get("visit_type", "").upper()
            if vt == "INDIVIDUAL":
                visit_type = "individual"
            elif vt == "CUSTOMER":
                visit_type = "store"
            else:
                visit_type = "store" if c.get("shop_id") else "individual"

            responses_json = vr.get("responses")

            # Extract individual data from responses
            if visit_type == "individual" and responses_json:
                try:
                    resp = json.loads(responses_json)
                    individual_name = resp.get("consumerName")
                    individual_surname = resp.get("consumerSurname")
                    individual_id_number = resp.get("idPassportNumber")
                    individual_phone = resp.get("cellphoneNumber")
                except (json.JSONDecodeError, TypeError):
                    pass

        ts = c["timestamp"]
        visit_date = ts.strftime("%Y-%m-%d") if ts else None
        check_in_time = ts.isoformat() if ts else None

        visit = {
            "id": new_id,
            "tenant_id": tenant_id,
            "agent_id": agent_uuid,
            "customer_id": customer_uuid,
            "visit_date": visit_date,
            "visit_type": visit_type,
            "check_in_time": check_in_time,
            "latitude": c.get("latitude"),
            "longitude": c.get("longitude"),
            "notes": c.get("notes", ""),
            "status": map_status(c.get("status")),
            "brand_id": mapper.get("brands", c.get("brand_id")),
            "category_id": mapper.get("categories", c.get("category_id")),
            "product_id": mapper.get("products", c.get("product_id")),
            "individual_name": individual_name,
            "individual_surname": individual_surname,
            "individual_id_number": individual_id_number,
            "individual_phone": individual_phone,
            "company_id": company_id,
            "created_at": check_in_time or datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        visits.append(visit)

        # Visit response
        if vr and responses_json:
            visit_responses.append({
                "id": gen_uuid(),
                "tenant_id": tenant_id,
                "visit_id": new_id,
                "visit_type": visit_type,
                "responses": responses_json,
                "created_at": vr["created_at"].isoformat() if vr.get("created_at") else check_in_time,
            })

        # Track individuals for dedup
        if visit_type == "individual" and individual_name:
            key = (individual_name, individual_surname or "", individual_id_number or "")
            if key not in individuals_map:
                individuals_map[key] = {
                    "id": gen_uuid(),
                    "tenant_id": tenant_id,
                    "first_name": individual_name,
                    "last_name": individual_surname or "",
                    "id_number": individual_id_number,
                    "phone": individual_phone,
                    "company_id": company_id,
                    "status": "active",
                    "created_at": check_in_time or datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                }

    transformed["visits"] = visits
    transformed["visit_responses"] = visit_responses
    transformed["individuals"] = list(individuals_map.values())
    print(f"  Transformed {len(visits)} visits")
    print(f"  Transformed {len(visit_responses)} visit responses")
    print(f"  Extracted {len(transformed['individuals'])} unique individuals")

    # ── Questionnaires ──────────────────────────────────────────────────
    print("\nTransforming questionnaires...")
    questionnaires = []
    for q in data["questionnaires"]:
        new_id = mapper.add("questionnaires", q["id"])
        vt = q.get("visit_type", "").lower()
        questionnaires.append({
            "id": new_id,
            "tenant_id": tenant_id,
            "name": q["name"],
            "visit_type": "individual" if vt == "individual" else "store",
            "brand_id": mapper.get("brands", q.get("brand_id")),
            "questions": q["questions"],
            "is_default": q.get("is_default", 0),
            "is_active": q.get("is_active", 1),
            "company_id": company_id,
            "created_at": q["created_at"].isoformat() if q.get("created_at") else datetime.utcnow().isoformat(),
            "updated_at": q["updated_at"].isoformat() if q.get("updated_at") else datetime.utcnow().isoformat(),
        })
    transformed["questionnaires"] = questionnaires
    print(f"  Transformed {len(questionnaires)} questionnaires")

    # ── Goals ───────────────────────────────────────────────────────────
    print("\nTransforming goals...")
    goals = []
    for g in data["goals"]:
        new_id = mapper.add("goals", g["id"])
        goals.append({
            "id": new_id,
            "tenant_id": tenant_id,
            "title": g["title"],
            "description": g.get("description", ""),
            "goal_type": g.get("goal_type"),
            "target_value": g["target_value"],
            "current_value": g.get("current_value", 0),
            "start_date": g["start_date"].isoformat() if g.get("start_date") else None,
            "end_date": g["end_date"].isoformat() if g.get("end_date") else None,
            "status": "active",
            "created_by": mapper.get("users", g.get("creator_id")),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        })
    transformed["goals"] = goals
    print(f"  Transformed {len(goals)} goals")

    # ── Goal Assignments ────────────────────────────────────────────────
    print("\nTransforming goal assignments...")
    goal_assignments = []
    for ga in data["goal_assignments"]:
        goal_assignments.append({
            "id": gen_uuid(),
            "goal_id": mapper.get("goals", ga["goal_id"]),
            "user_id": mapper.get("users", ga["user_id"]),
            "target_value": None,
            "current_value": None,
        })
    transformed["goal_assignments"] = goal_assignments
    print(f"  Transformed {len(goal_assignments)} goal assignments")

    return transformed


# ── Data Loading ────────────────────────────────────────────────────────────

def build_insert_sql(table, row, columns=None):
    """Build an INSERT statement for a single row."""
    if columns is None:
        columns = list(row.keys())
    values = [escape_sql(row.get(c)) for c in columns]
    cols_str = ", ".join(columns)
    vals_str = ", ".join(values)
    return f"INSERT INTO {table} ({cols_str}) VALUES ({vals_str});"

def load_data(transformed, dry_run=False):
    """Load transformed data into D1."""

    # Phase 1: Insert users WITHOUT self-referencing FKs (manager_id, team_lead_id)
    print("\n  Phase 1: Insert users without manager/team_lead references...")
    users_phase1_cols = ["id", "tenant_id", "email", "phone", "password_hash", "first_name", "last_name", "role", "status", "is_active", "admin_viewable_password", "created_at", "updated_at"]
    user_rows = transformed.get("users", [])
    if user_rows and not dry_run:
        errors = 0
        for row in user_rows:
            sql = build_insert_sql("users", row, users_phase1_cols)
            try:
                d1_query(sql)
            except Exception as e:
                error_msg = str(e)
                if "UNIQUE constraint" not in error_msg:
                    errors += 1
                    if errors <= 3:
                        print(f"    ERROR: {error_msg[:200]}")
        print(f"    Inserted {len(user_rows)} users ({errors} errors)")
    elif user_rows and dry_run:
        print(f"    [DRY RUN] Would insert {len(user_rows)} users")

    # Phase 2: Update users with manager_id and team_lead_id
    print("\n  Phase 2: Update users with manager/team_lead references...")
    if user_rows and not dry_run:
        updated = 0
        for row in user_rows:
            mgr = row.get("manager_id")
            tl = row.get("team_lead_id")
            if mgr or tl:
                sets = []
                if mgr:
                    sets.append(f"manager_id = {escape_sql(mgr)}")
                if tl:
                    sets.append(f"team_lead_id = {escape_sql(tl)}")
                sql = f"UPDATE users SET {', '.join(sets)} WHERE id = {escape_sql(row['id'])}"
                try:
                    d1_query(sql)
                    updated += 1
                except Exception as e:
                    pass  # Non-critical — user still exists
        print(f"    Updated {updated} users with hierarchy references")
    elif user_rows and dry_run:
        refs = sum(1 for r in user_rows if r.get("manager_id") or r.get("team_lead_id"))
        print(f"    [DRY RUN] Would update {refs} users with hierarchy references")

    load_order = [
        ("brands", ["id", "tenant_id", "name", "code", "description", "status", "created_at"]),
        ("categories", ["id", "tenant_id", "brand_id", "name", "code", "description", "status", "created_at"]),
        ("products", ["id", "tenant_id", "name", "code", "category_id", "brand_id", "status", "created_at"]),
        ("agent_company_assignments", ["id", "user_id", "tenant_id", "role_override", "granted_by", "granted_at", "revoked_at"]),
        ("agent_company_links", ["id", "agent_id", "company_id", "tenant_id", "is_active", "assigned_at"]),
        ("manager_company_links", ["id", "manager_id", "company_id", "tenant_id", "is_active", "assigned_at"]),
        ("customers", ["id", "tenant_id", "name", "type", "customer_type", "address", "latitude", "longitude", "status", "created_at", "updated_at"]),
        ("individuals", ["id", "tenant_id", "first_name", "last_name", "id_number", "phone", "company_id", "status", "created_at", "updated_at"]),
        ("questionnaires", ["id", "tenant_id", "name", "visit_type", "brand_id", "questions", "is_default", "is_active", "company_id", "created_at", "updated_at"]),
        ("visits", ["id", "tenant_id", "agent_id", "customer_id", "visit_date", "visit_type", "check_in_time", "latitude", "longitude", "notes", "status", "brand_id", "category_id", "product_id", "individual_name", "individual_surname", "individual_id_number", "individual_phone", "company_id", "created_at", "updated_at"]),
        ("visit_responses", ["id", "tenant_id", "visit_id", "visit_type", "responses", "created_at"]),
        ("goals", ["id", "tenant_id", "title", "description", "goal_type", "target_value", "current_value", "start_date", "end_date", "status", "created_by", "created_at", "updated_at"]),
        ("goal_assignments", ["id", "goal_id", "user_id", "target_value", "current_value"]),
    ]

    total_rows = 0
    for table, columns in load_order:
        rows = transformed.get(table, [])
        if not rows:
            print(f"  {table}: 0 rows (skipped)")
            continue

        print(f"\n  Loading {table}: {len(rows)} rows...")

        if dry_run:
            print(f"    [DRY RUN] Would insert {len(rows)} rows")
            # Show first row as example
            if rows:
                sql = build_insert_sql(table, rows[0], columns)
                print(f"    Example: {sql[:200]}...")
            total_rows += len(rows)
            continue

        # Execute in batches
        batch_size = 20  # D1 has limits on SQL size
        errors = 0
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i+batch_size]
            for row in batch:
                sql = build_insert_sql(table, row, columns)
                try:
                    d1_query(sql)
                except Exception as e:
                    error_msg = str(e)
                    # Skip duplicate key errors silently
                    if "UNIQUE constraint" in error_msg or "already exists" in error_msg:
                        pass
                    else:
                        errors += 1
                        if errors <= 3:
                            print(f"    ERROR on row: {error_msg[:200]}")

            progress = min(i + batch_size, len(rows))
            if progress % 100 == 0 or progress == len(rows):
                print(f"    Progress: {progress}/{len(rows)} ({errors} errors)")

            # Small delay to avoid rate limiting
            if i > 0 and i % 200 == 0:
                time.sleep(1)

        total_rows += len(rows)
        if errors:
            print(f"    Completed with {errors} errors")
        else:
            print(f"    Completed successfully")

    print(f"\n  Total rows processed: {total_rows}")
    return total_rows


def load_photos(data, mapper, tenant_id, dry_run=False):
    """Load photo base64 data into visits table (separate pass for large data)."""
    # Get checkin IDs that have photos
    checkin_ids_with_photos = [
        c["id"] for c in data["checkins"]
        if c.get("photo_b64_len") and c["photo_b64_len"] > 0
    ]
    print(f"\nPhotos: {len(checkin_ids_with_photos)} checkins have photos")

    if dry_run:
        print("  [DRY RUN] Would update photo_base64 for these visits")
        return

    if not checkin_ids_with_photos:
        return

    # Extract photos in batches
    photos = extract_photos_batch(checkin_ids_with_photos)

    # Update visits with photo data
    updated = 0
    errors = 0
    for old_id, photo_data in photos.items():
        visit_uuid = mapper.get("checkins", old_id)
        if not visit_uuid:
            continue

        # Update primary photo
        if photo_data.get("photo_base64"):
            b64 = photo_data["photo_base64"].replace("'", "''")
            sql = f"UPDATE visits SET photo_base64 = '{b64}' WHERE id = '{visit_uuid}' AND tenant_id = '{tenant_id}'"
            try:
                d1_query(sql)
                updated += 1
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"  Photo error: {str(e)[:200]}")

        # Update additional photos
        if photo_data.get("additional_photos_base64"):
            b64 = photo_data["additional_photos_base64"].replace("'", "''")
            sql = f"UPDATE visits SET additional_photos = '{b64}' WHERE id = '{visit_uuid}' AND tenant_id = '{tenant_id}'"
            try:
                d1_query(sql)
            except Exception as e:
                errors += 1

        if updated % 50 == 0 and updated > 0:
            print(f"  Photos updated: {updated}/{len(photos)} ({errors} errors)")
            time.sleep(1)

    print(f"  Photos complete: {updated} updated, {errors} errors")


# ── Test Tenant Setup ───────────────────────────────────────────────────────

def create_test_tenant():
    """Create a test tenant and company for validation."""
    test_tenant_id = f"migration-test-{gen_uuid()[:8]}"
    test_company_id = gen_uuid()

    print(f"\nCreating test tenant: {test_tenant_id}")
    d1_query(f"""
        INSERT INTO tenants (id, name, code, status, created_at, updated_at)
        VALUES ('{test_tenant_id}', 'Migration Test', 'MIGTEST', 'active',
                '{datetime.utcnow().isoformat()}', '{datetime.utcnow().isoformat()}')
    """)

    print(f"Creating test company: {test_company_id}")
    d1_query(f"""
        INSERT INTO field_companies (id, tenant_id, name, code, status, created_at, updated_at)
        VALUES ('{test_company_id}', '{test_tenant_id}', 'Goldrush Test', 'GRTEST', 'active',
                '{datetime.utcnow().isoformat()}', '{datetime.utcnow().isoformat()}')
    """)

    # Create admin user for test tenant
    admin_id = gen_uuid()
    d1_query(f"""
        INSERT INTO users (id, tenant_id, email, phone, password_hash, first_name, last_name, role, status, is_active, created_at, updated_at)
        VALUES ('{admin_id}', '{test_tenant_id}', 'admin@migtest.local', '+27000000000',
                '$2b$12$LJ3m4ys3Lf0Xg1q5g0z5/.qV5R5z5z5z5z5z5z5z5z5z5z5z5z5z',
                'Migration', 'Admin', 'admin', 'active', 1,
                '{datetime.utcnow().isoformat()}', '{datetime.utcnow().isoformat()}')
    """)

    return test_tenant_id, test_company_id


def cleanup_test_tenant(test_tenant_id):
    """Remove test tenant data."""
    tables = [
        "goal_assignments", "goals", "visit_responses", "visits",
        "individuals", "customers", "questionnaires", "products",
        "categories", "brands", "manager_company_links",
        "agent_company_links", "agent_company_assignments", "users",
        "field_companies", "tenants",
    ]
    print(f"\nCleaning up test tenant: {test_tenant_id}")
    for table in tables:
        try:
            if table == "tenants":
                d1_query(f"DELETE FROM {table} WHERE id = '{test_tenant_id}'")
            elif table == "goal_assignments":
                d1_query(f"DELETE FROM {table} WHERE goal_id IN (SELECT id FROM goals WHERE tenant_id = '{test_tenant_id}')")
            else:
                d1_query(f"DELETE FROM {table} WHERE tenant_id = '{test_tenant_id}'")
            print(f"  Cleaned {table}")
        except Exception as e:
            print(f"  Error cleaning {table}: {e}")


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="SalesSync → Fieldvibe Migration")
    parser.add_argument("--mode", choices=["test", "full", "dry-run", "photos-only"], required=True,
                        help="test: sample import to test tenant; full: full import to Goldrush; dry-run: show what would happen; photos-only: import photos for existing visits")
    parser.add_argument("--sample-limit", type=int, default=50,
                        help="Number of shops/checkins to import in test mode (default: 50)")
    parser.add_argument("--skip-photos", action="store_true",
                        help="Skip photo import (faster)")
    parser.add_argument("--cleanup", action="store_true",
                        help="Clean up test tenant after validation")
    args = parser.parse_args()

    print("=" * 60)
    print(f"SalesSync → Fieldvibe Migration ({args.mode} mode)")
    print("=" * 60)

    # Determine target
    if args.mode == "test":
        tenant_id, company_id = create_test_tenant()
        sample_limit = args.sample_limit
    elif args.mode in ("full", "photos-only"):
        tenant_id = GOLDRUSH_TENANT_ID
        company_id = GOLDRUSH_COMPANY_ID
        sample_limit = None
    else:  # dry-run
        tenant_id = GOLDRUSH_TENANT_ID
        company_id = GOLDRUSH_COMPANY_ID
        sample_limit = None

    # Extract
    print("\n── Extracting data from MySQL ──")
    data = extract_mysql_data(limit=sample_limit)

    # Transform
    print("\n── Transforming data ──")
    mapper = IDMapper()
    transformed = transform_data(data, tenant_id, company_id, mapper)

    # Load
    print("\n── Loading data into D1 ──")
    if args.mode == "photos-only":
        load_photos(data, mapper, tenant_id, dry_run=False)
    else:
        load_data(transformed, dry_run=(args.mode == "dry-run"))

        if not args.skip_photos and args.mode != "dry-run":
            load_photos(data, mapper, tenant_id, dry_run=False)

    # Save ID mapping for reference
    mapping_file = f"/tmp/id_mapping_{args.mode}_{int(time.time())}.json"
    with open(mapping_file, "w") as f:
        json.dump(mapper.dump(), f, indent=2)
    print(f"\nID mapping saved to: {mapping_file}")

    # Verification
    if args.mode != "dry-run":
        print("\n── Verification ──")
        for table in ["users", "customers", "visits", "visit_responses", "individuals", "brands", "questionnaires", "goals"]:
            result = d1_query(f"SELECT COUNT(*) as cnt FROM {table} WHERE tenant_id = '{tenant_id}'")
            count = result["results"][0]["cnt"] if result and result.get("results") else 0
            print(f"  {table}: {count} rows")

    # Cleanup test tenant if requested
    if args.mode == "test" and args.cleanup:
        cleanup_test_tenant(tenant_id)

    print("\n" + "=" * 60)
    print("Migration complete!")
    if args.mode == "test":
        print(f"Test tenant ID: {tenant_id}")
        print(f"Test company ID: {company_id}")
        print(f"To clean up: python3 {__file__} --mode test --cleanup")
    print("=" * 60)


if __name__ == "__main__":
    main()
