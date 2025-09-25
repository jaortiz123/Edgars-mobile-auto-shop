"""
Rate Limiting Middleware for Edgar's Auto Shop API
Implements token bucket algorithm for API rate limiting.
"""

import hashlib
import logging
import time
from functools import wraps
from typing import Dict

import redis
from flask import g, jsonify, request

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token bucket rate limiter using Redis for distributed rate limiting."""

    def __init__(self, redis_client=None):
        self.redis_client = redis_client or redis.Redis(
            host="localhost", port=6379, db=0, socket_connect_timeout=1, socket_timeout=1
        )

    def get_client_id(self, request) -> str:
        """Generate unique client identifier."""
        # Use IP + User-Agent for basic fingerprinting
        client_ip = request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr)
        user_agent = request.headers.get("User-Agent", "")

        # Hash for privacy
        client_data = f"{client_ip}:{user_agent}"
        return hashlib.md5(client_data.encode()).hexdigest()

    def is_allowed(self, key: str, limit: int, window: int) -> tuple[bool, Dict]:
        """
        Check if request is allowed using sliding window counter.

        Args:
            key: Unique identifier for the rate limit
            limit: Number of requests allowed
            window: Time window in seconds

        Returns:
            (allowed, info) where info contains current count and reset time
        """
        try:
            current_time = int(time.time())
            window_start = current_time - window

            # Use Redis pipeline for atomic operations
            pipe = self.redis_client.pipeline()

            # Remove expired entries
            pipe.zremrangebyscore(key, 0, window_start)

            # Count current requests
            pipe.zcard(key)

            # Add current request
            pipe.zadd(key, {str(current_time): current_time})

            # Set expiration
            pipe.expire(key, window)

            results = pipe.execute()
            current_count = results[1] + 1  # +1 for the request we just added

            return current_count <= limit, {
                "current": current_count,
                "limit": limit,
                "reset": current_time + window,
                "window": window,
            }

        except Exception as e:
            logger.error(f"Rate limiter error: {e}")
            # Fail open - allow request if Redis is down
            return True, {"error": "rate_limiter_unavailable"}

    def rate_limit(self, requests_per_minute: int = 60, per_ip: bool = True):
        """
        Flask decorator for rate limiting.

        Args:
            requests_per_minute: Number of requests allowed per minute
            per_ip: If True, limit per IP. If False, global limit.
        """

        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                if per_ip:
                    client_id = self.get_client_id(request)
                    rate_key = f"rate_limit:ip:{client_id}"
                else:
                    rate_key = f"rate_limit:global:{f.__name__}"

                allowed, info = self.is_allowed(rate_key, requests_per_minute, 60)

                if not allowed:
                    logger.warning(f"Rate limit exceeded for {rate_key}: {info}")
                    return (
                        jsonify(
                            {
                                "error": "Rate limit exceeded",
                                "message": f'Too many requests. Limit: {info["limit"]}/minute',
                                "retry_after": info.get("reset", time.time() + 60) - time.time(),
                            }
                        ),
                        429,
                    )

                # Add rate limit headers
                g.rate_limit_info = info
                return f(*args, **kwargs)

            return decorated_function

        return decorator


# Global rate limiter instance
rate_limiter = RateLimiter()


# Common rate limit decorators
def api_rate_limit(requests_per_minute: int = 60):
    """Standard API rate limit decorator."""
    return rate_limiter.rate_limit(requests_per_minute, per_ip=True)


def admin_rate_limit(requests_per_minute: int = 30):
    """Stricter rate limit for admin endpoints."""
    return rate_limiter.rate_limit(requests_per_minute, per_ip=True)


def public_rate_limit(requests_per_minute: int = 20):
    """Rate limit for public endpoints (quotes, etc.)."""
    return rate_limiter.rate_limit(requests_per_minute, per_ip=True)


# Flask after_request handler to add rate limit headers
def add_rate_limit_headers(response):
    """Add rate limiting headers to response."""
    if hasattr(g, "rate_limit_info"):
        info = g.rate_limit_info
        if "error" not in info:
            response.headers["X-RateLimit-Limit"] = str(info["limit"])
            response.headers["X-RateLimit-Remaining"] = str(max(0, info["limit"] - info["current"]))
            response.headers["X-RateLimit-Reset"] = str(info["reset"])

    return response
