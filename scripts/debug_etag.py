#!/usr/bin/env python3
"""
Debug script to compare customer data between profile endpoint query and PATCH endpoint query
"""

import hashlib
import json

import psycopg2
import psycopg2.extras


def _strong_etag(kind, row, editable_fields):
    """Compute strong ETag like the backend does."""
    ts = row.get("ts") or row.get("updated_at") or row.get("created_at") or "0"
    parts = [kind, str(row.get("id")), str(ts)]
    for f in sorted(editable_fields):
        parts.append(f"{f}={row.get(f)}")
    src = "|".join(parts)
    return 'W/"' + hashlib.sha1(src.encode("utf-8")).hexdigest() + '"'


# Connect to database
conn = psycopg2.connect(
    host="localhost",
    port=5432,  # Docker port mapping
    database="postgres",
    user="postgres",
    password="postgres",
)

customer_id = 3  # Use a customer that should exist

with conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Query 1: Profile endpoint style (original)
        print("=== Profile Endpoint Query ===")
        cur.execute(
            """
            SELECT id, name, email, phone, is_vip, address, full_name, tags, notes, sms_consent,
                   to_char(GREATEST(updated_at, created_at),'YYYY-MM-DD"T"HH24:MI:SS.US') AS ts
              FROM customers
             WHERE id = %s
            """,
            (customer_id,),
        )
        profile_customer = cur.fetchone()

        if profile_customer:
            print(f"Profile data: {dict(profile_customer)}")
            profile_etag_data = {
                "id": profile_customer.get("id"),  # Use raw ID (int) as PATCH does
                "name": profile_customer.get("name"),  # Use raw name as PATCH does
                "full_name": profile_customer.get("full_name"),
                "email": profile_customer.get("email"),
                "phone": profile_customer.get("phone"),
                "tags": profile_customer.get("tags", []),
                "notes": profile_customer.get("notes"),
                "sms_consent": profile_customer.get("sms_consent", False),
                "ts": profile_customer.get("ts"),
            }
            profile_etag = _strong_etag(
                "customer",
                profile_etag_data,
                ["name", "full_name", "email", "phone", "tags", "notes", "sms_consent"],
            )
            print(f"Profile ETag data: {json.dumps(profile_etag_data, indent=2, default=str)}")
            print(f"Profile ETag: {profile_etag}")
        else:
            print("Customer not found with profile query")

        # Query 2: PATCH endpoint style (_get_customer_row) - exact copy
        print("\n=== PATCH Endpoint Query ===")
        cur.execute(
            "SELECT id, name, email, phone, is_vip, address, full_name, tags, notes, sms_consent, to_char(GREATEST(updated_at, created_at),'YYYY-MM-DD"
            "T"
            "HH24:MI:SS.US') AS ts FROM customers WHERE id=%s",
            (customer_id,),
        )
        patch_customer = cur.fetchone()

        if patch_customer:
            print(f"PATCH data: {dict(patch_customer)}")
            patch_etag = _strong_etag(
                "customer",
                patch_customer,
                ["name", "full_name", "email", "phone", "tags", "notes", "sms_consent"],
            )
            print(f"PATCH ETag data: {json.dumps(dict(patch_customer), indent=2, default=str)}")
            print(f"PATCH ETag: {patch_etag}")
        else:
            print("Customer not found with PATCH query")

        # Compare
        if profile_customer and patch_customer:
            print("\n=== Comparison ===")
            print(f"ETags match: {profile_etag == patch_etag}")
            if profile_etag != patch_etag:
                print("Differences:")
                for key in profile_customer.keys():
                    if profile_customer.get(key) != patch_customer.get(key):
                        print(
                            f"  {key}: profile={profile_customer.get(key)!r}, patch={patch_customer.get(key)!r}"
                        )
