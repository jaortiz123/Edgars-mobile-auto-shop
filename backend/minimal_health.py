#!/usr/bin/env python3
"""Minimal health check for Lambda debugging"""

import json


def handler(event, context):
    """Basic Lambda handler for health check"""
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(
            {
                "status": "ok",
                "service": "edgar-auto-shop-dev",
                "version": "1.0.0",
                "lambda_context": {
                    "function_name": context.function_name if context else "unknown",
                    "memory_limit": context.memory_limit_in_mb if context else "unknown",
                    "request_id": context.aws_request_id if context else "unknown",
                },
            }
        ),
    }


if __name__ == "__main__":
    # Simple local test
    print(json.dumps(handler(None, None), indent=2))
