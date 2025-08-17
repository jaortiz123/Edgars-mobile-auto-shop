#!/usr/bin/env python3
"""Service Catalog seed generator (v2)."""

from __future__ import annotations

import argparse
import csv
import sys

ALLOWED_CATEGORIES = {
    "MAINTENANCE",
    "BRAKES",
    "ENGINE_DIAGNOSTICS",
    "TRANSMISSION_DRIVETRAIN",
    "TIRES_STEERING_SUSPENSION",
    "HVAC",
    "ELECTRICAL_BATTERY",
    "COOLING_SYSTEM",
    "ADAS",
    "INSPECTION_SAFETY",
}


def derive_hours(h: float) -> tuple[float, float, float]:
    h = float(h)
    min_h = round(max(0.25, h * 0.60), 2)
    typ_h = round(h, 2)
    max_h = round(max(h * 1.40, typ_h + 0.25), 2)
    return min_h, typ_h, max_h


def esc(s: str) -> str:
    return s.replace("'", "''")


def pg_kw_array(csv_str: str) -> str:
    kws = [k.strip() for k in (csv_str or "").split(",") if k.strip()]
    if not kws:
        return "{}"
    return "{" + ", ".join(f'"{k}"' for k in kws) + "}"


def row_to_values(r: dict[str, str]) -> dict[str, str]:
    internal_code = r["internal_code"].strip()
    if not internal_code:
        raise ValueError("internal_code is required")
    name = r["name"].strip()
    if not name:
        raise ValueError(f"name is required for {internal_code}")
    category = r["category"].strip()
    if category not in ALLOWED_CATEGORIES:
        raise ValueError(f"category '{category}' not in allowed set for {internal_code}")
    try:
        price_cents = int(float(r["default_price_cents"]))
        if price_cents < 0:
            raise ValueError
    except Exception:  # noqa: BLE001
        raise ValueError(f"default_price_cents must be >=0 for {internal_code}") from None
    try:
        default_hours = float(r["default_hours"])
    except Exception:  # noqa: BLE001
        raise ValueError(f"default_hours must be a number for {internal_code}") from None
    if default_hours <= 0:
        raise ValueError(f"default_hours must be >0 for {internal_code}")
    min_h, typ_h, max_h = derive_hours(default_hours)
    try:
        level = int(r["skill_level"])
        if level < 1 or level > 5:
            raise ValueError
    except Exception:  # noqa: BLE001
        raise ValueError(f"skill_level must be 1..5 for {internal_code}") from None
    requires_senior = "true" if level >= 4 else "false"
    base_labor_rate = round(price_cents / 100.0, 2)
    kw_pg = pg_kw_array(r.get("keywords", ""))
    is_active = "true" if str(r.get("is_active", "true")).lower() == "true" else "false"
    return {
        "id": internal_code,
        "name": name,
        "category": category,
        "min_hours": f"{min_h:.2f}",
        "typical_hours": f"{typ_h:.2f}",
        "max_hours": f"{max_h:.2f}",
        "base_labor_rate": f"{base_labor_rate:.2f}",
        "requires_senior_tech": requires_senior,
        "skill_level": str(level),
        "vehicle_types": "{ALL}",
        "keywords": kw_pg,
        "is_active": is_active,
    }


def generate_insert(values: dict[str, str], pretty: bool, upsert: bool) -> str:
    tbl = "service_operations"
    if pretty:
        head = (
            f"INSERT INTO {tbl} (\n"
            "  id,\n  name,\n  category,\n  min_hours,\n  typical_hours,\n  max_hours,\n"
            "  base_labor_rate,\n  requires_senior_tech,\n  skill_level,\n"
            "  vehicle_types,\n  keywords,\n  is_active\n) VALUES (\n"
        )
        vals = (
            f"  '{esc(values['id'])}',\n"
            f"  '{esc(values['name'])}',\n"
            f"  '{values['category']}',\n"
            f"  {values['min_hours']},\n"
            f"  {values['typical_hours']},\n"
            f"  {values['max_hours']},\n"
            f"  {values['base_labor_rate']},\n"
            f"  {values['requires_senior_tech']},\n"
            f"  {values['skill_level']},\n"
            f"  '{values['vehicle_types']}',\n"
            f"  '{values['keywords']}',\n"
            f"  {values['is_active']}\n)"
        )
        sql = head + vals
    else:
        sql = (
            f"INSERT INTO {tbl} (id, name, category, min_hours, typical_hours, max_hours, "
            f"base_labor_rate, requires_senior_tech, skill_level, vehicle_types, keywords, is_active) VALUES "
            f"('{esc(values['id'])}', '{esc(values['name'])}', '{values['category']}', {values['min_hours']}, "
            f"{values['typical_hours']}, {values['max_hours']}, {values['base_labor_rate']}, {values['requires_senior_tech']}, "
            f"{values['skill_level']}, '{values['vehicle_types']}', '{values['keywords']}', {values['is_active']})"
        )
    if upsert:
        sql += (
            " ON CONFLICT (id) DO UPDATE SET "
            "name = EXCLUDED.name, "
            "category = EXCLUDED.category, "
            "min_hours = EXCLUDED.min_hours, "
            "typical_hours = EXCLUDED.typical_hours, "
            "max_hours = EXCLUDED.max_hours, "
            "base_labor_rate = EXCLUDED.base_labor_rate, "
            "requires_senior_tech = EXCLUDED.requires_senior_tech, "
            "skill_level = EXCLUDED.skill_level, "
            "vehicle_types = EXCLUDED.vehicle_types, "
            "keywords = EXCLUDED.keywords, "
            "is_active = EXCLUDED.is_active"
        )
    sql += ";"
    return sql


def load_rows(path: str) -> list[dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def check_duplicates(rows: list[dict[str, str]]) -> list[str]:
    seen, dups = set(), []
    for r in rows:
        code = r["internal_code"].strip()
        if code in seen:
            dups.append(code)
        seen.add(code)
    return dups


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="service_catalog_master.csv")
    ap.add_argument("--out", default="seed_v2_catalog.sql")
    ap.add_argument("--schema", choices=["minimal", "rich"], default="minimal")
    ap.add_argument("--upsert", action="store_true")
    ap.add_argument("--pretty", action="store_true")
    args = ap.parse_args()
    rows = load_rows(args.csv)
    if not rows:
        print("No rows found in CSV", file=sys.stderr)
        sys.exit(1)
    dups = check_duplicates(rows)
    if dups:
        print(f"ERROR: duplicate internal_code(s): {', '.join(sorted(dups))}", file=sys.stderr)
        sys.exit(2)
    sql_lines = ["-- AUTO-GENERATED: seed_v2_catalog.sql", "BEGIN;"]
    for r in rows:
        vals = row_to_values(r)
        sql_lines.append(generate_insert(vals, pretty=args.pretty, upsert=args.upsert))
    sql_lines.append("COMMIT;")
    with open(args.out, "w", encoding="utf-8") as out:
        out.write("\n".join(sql_lines) + "\n")
    print(f"Wrote {args.out} ({len(rows)} INSERTs)")


if __name__ == "__main__":
    main()
