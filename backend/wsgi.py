# Production WSGI Configuration
# Edgar's Mobile Auto Shop - Production Server Implementation

"""
WSGI Entry Point for Production Deployment

This module provides the WSGI application interface for production deployment
using Gunicorn or other WSGI servers. It replaces the Flask development server
with a production-ready configuration.

Usage:
    gunicorn --bind 0.0.0.0:5000 --workers 4 backend.wsgi:application
"""

import os
import sys
from pathlib import Path

# Set production environment before any Flask imports
os.environ["APP_ENV"] = "production"
os.environ["FLASK_ENV"] = "production"

# Add backend directory to Python path
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Also add parent directory for backend module imports
parent_dir = backend_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

# Import the Flask application
import local_server

# Get the configured Flask app
application = local_server.app

# Configure for production
application.config["ENV"] = "production"
application.config["DEBUG"] = False
application.config["TESTING"] = False

if __name__ == "__main__":
    # Development fallback
    application.run(host="0.0.0.0", port=5000)
