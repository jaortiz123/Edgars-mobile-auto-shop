# Edgar's Mobile Auto Shop - Current Context
Last Updated: 2025-07-27 14:30 PST

## 🔴 Active Issues (Give this to Gemini)

### Backend Fixes Needed:
```python
# FILE: backend/local_server.py

# 1. MISSING ROUTE (Line ~566)
# Add: @app.route('/api/admin/appointments', methods=['GET'])
def get_admin_appointments():  # ❌ NO DECORATOR
    # Also fix: Change 'start_ts' to COALESCE(start, scheduled_date + scheduled_time)

# 2. MISSING ROUTE (Line ~617)  
# Add: @app.route('/api/admin/appointments', methods=['POST'])
def create_appointment():  # ❌ NO DECORATOR
    # Also fix: Change UPDATE to INSERT INTO appointments

# 3. MISSING ENDPOINT
# Add new function with @app.route('/api/admin/appointments/<id>/status', methods=['PATCH'])

# 4. DB CONNECTION (Line ~45)
# Change: host="db" → host=os.getenv("POSTGRES_HOST", "db")
# Add: connect_timeout=2