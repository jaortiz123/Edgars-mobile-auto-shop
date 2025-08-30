# DATABASE CONNECTION FIX for RLS
# CRITICAL: Change from superuser to application user

# BEFORE (bypasses RLS):
# DATABASE_URL=postgresql://postgres:password@localhost:5432/autoshop

# AFTER (respects RLS):
DATABASE_URL=postgresql://edgars_app:secure_app_password_change_in_prod@localhost:5432/autoshop

# This ensures RLS policies are enforced because edgars_app is not a superuser
