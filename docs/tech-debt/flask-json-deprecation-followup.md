# Tech Debt: Update Flask JSON imports

Context
- Pytest emits warnings because Flask still imports `itsdangerous.json`, which will be removed in ItsDangerous 2.1.
- Mobile appointments HTTP contract tests surface the warning on every run.

Impact
- Future upgrades to Flask/ItsDangerous will break JSON serialization helpers.
- Noise in test output can hide new warnings and slows gate reviews.

Follow-Up
- Replace Flask's `flask.json` helpers with Python's built-in `json` module (or upgrade Flask when available).
- Confirm `_ok`/`_error` envelopes keep their shape after the swap.
- Add regression test that asserts no `itsdangerous.json` deprecation warnings during pytest boot.

Owner
- Jesus (Backend Platform)

Timeline
- Target next hardening sprint (due by 2025-10-10).
