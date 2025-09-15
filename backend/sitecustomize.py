# Auto-loaded by Python if PYTHONPATH includes "backend"
import os
import sqlite3


class _CursorProxy:
    def __init__(self, cur):
        self._cur = cur

    def __getattr__(self, n):
        return getattr(self._cur, n)

    def __enter__(self):
        return self._cur

    def __exit__(self, *exc):
        try:
            self._cur.close()
        except Exception:
            pass


class _CMConn(sqlite3.Connection):
    def cursor(self, *a, **kw):
        return _CursorProxy(super().cursor(*a, **kw))


if os.environ.get("UNIT_DB", "sqlite").startswith("sqlite"):
    _orig = sqlite3.connect

    def _connect(*a, **kw):
        kw.setdefault("factory", _CMConn)
        return _orig(*a, **kw)

    sqlite3.connect = _connect
