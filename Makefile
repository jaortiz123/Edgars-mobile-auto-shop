.PHONY: lint-all lint-debt-report tag-major tag-minor tag-patch

# Run Ruff across entire repo (non-fatal) to view all issues locally
lint-all:
	ruff check . || true

# Produce a grouped debt report file locally (ignores exit status)
lint-debt-report:
	ruff check . --output-format grouped > ruff_report.txt || true
	@echo "Wrote ruff_report.txt ($$(wc -l < ruff_report.txt || echo 0) lines)"

tag-major:
	gh workflow run "Auto Tag (manual)" -f bump=major

tag-minor:
	gh workflow run "Auto Tag (manual)" -f bump=minor

tag-patch:
	gh workflow run "Auto Tag (manual)" -f bump=patch
