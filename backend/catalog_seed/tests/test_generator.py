import importlib.util
import pathlib

import pytest

GEN_PATH = pathlib.Path(__file__).resolve().parents[1] / "generate_seed_v2.py"
spec = importlib.util.spec_from_file_location("generate_seed_v2", GEN_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

derive_hours = module.derive_hours
generate_insert = module.generate_insert
row_to_values = module.row_to_values


def test_derive_hours_rounding_and_floor():
    assert derive_hours(1.0) == (0.6, 1.0, 1.4)
    # floors to 0.25 minimum
    assert derive_hours(0.3)[0] == 0.25


def test_generate_insert_pretty_and_upsert():
    vals = row_to_values(
        {
            "internal_code": "OIL_SYNTH",
            "name": "Full Synthetic Oil Change",
            "category": "MAINTENANCE",
            "default_price_cents": "12000",
            "default_hours": "0.5",
            "skill_level": "1",
            "keywords": "oil, synthetic, filter",
            "is_active": "true",
        }
    )
    sql = generate_insert(vals, pretty=True, upsert=True)
    assert "\n  id,\n" in sql  # pretty formatting
    assert "ON CONFLICT (id) DO UPDATE" in sql  # upsert clause present


def test_row_validation_enforces_category_and_levels():
    with pytest.raises(ValueError):
        row_to_values(
            {
                "internal_code": "BAD",
                "name": "Bad Row",
                "category": "NOT_A_CATEGORY",
                "default_price_cents": "0",
                "default_hours": "1",
                "skill_level": "1",
                "keywords": "",
                "is_active": "true",
            }
        )
