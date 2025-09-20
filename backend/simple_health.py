"""
Simple health check app for Lambda deployment testing
"""

import logging
import os

from flask import Flask, jsonify

# Create simple Flask app
app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)


@app.route("/healthz")
def health():
    """Simple health check that returns immediately"""
    return (
        jsonify(
            {
                "status": "healthy",
                "service": "edgar-auto-shop",
                "version": "1.0.0",
                "environment": os.environ.get("FLASK_ENV", "development"),
                "lambda_context": "aws-lambda-web-adapter",
            }
        ),
        200,
    )


@app.route("/")
def root():
    """Root endpoint"""
    return (
        jsonify(
            {
                "message": "Edgar's Mobile Auto Shop API",
                "version": "1.0.0",
                "health_endpoint": "/healthz",
            }
        ),
        200,
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
