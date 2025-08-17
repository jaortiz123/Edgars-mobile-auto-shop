PY ?= python3
CSV ?= service_catalog_master.csv
OUT ?= seed_v2_catalog.sql

.PHONY: seed seed-upsert test lint format check-seed-ci

seed:
	$(PY) generate_seed_v2.py --csv $(CSV) --out $(OUT) --schema minimal --pretty

seed-upsert:
	$(PY) generate_seed_v2.py --csv $(CSV) --out $(OUT) --schema minimal --pretty --upsert

test:
	pytest -q tests

lint:
	ruff check catalog_seed generate_seed_v2.py

format:
	black catalog_seed generate_seed_v2.py && ruff check catalog_seed generate_seed_v2.py --fix

check-seed-ci:
	catalog-seed --csv backend/catalog_seed/$(CSV) --out seed_v2_catalog.sql --schema minimal --pretty --upsert
	git diff --exit-code seed_v2_catalog.sql
