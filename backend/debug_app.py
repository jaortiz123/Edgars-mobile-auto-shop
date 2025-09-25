"""
Debug Lambda Web Adapter connectivity issue
Very simple WSGI app to isolate the problem
"""


def application(environ, start_response):
    """Simplest possible WSGI app for debugging"""
    print(
        f"WSGI called with environ: {environ.get('REQUEST_METHOD', 'UNKNOWN')} {environ.get('PATH_INFO', '/')}"
    )

    status = "200 OK"
    headers = [("Content-Type", "application/json")]
    start_response(status, headers)

    return [b'{"status": "ok", "message": "Direct WSGI working"}']


# Also create a Flask app for comparison
from flask import Flask


def create_debug_app():
    app = Flask(__name__)

    @app.route("/debug")
    def debug():
        return {"status": "flask_ok", "message": "Flask debug endpoint"}

    return app


flask_app = create_debug_app()

# Export both for testing
app = application
wsgi_app = application
flask_wsgi_app = flask_app
