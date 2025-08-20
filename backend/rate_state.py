"""Singleton rate limit state.

All modules must import _RATE and _RATE_LOCK from here to avoid duplicate
module import path issues (backend.local_server vs local_server).
"""

from __future__ import annotations

import threading

_RATE: dict[str, tuple[int, float]] = {}
_RATE_LOCK = threading.Lock()

__all__ = ["_RATE", "_RATE_LOCK"]
