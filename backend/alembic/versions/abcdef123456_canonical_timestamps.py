"""canonical timestamps placeholder (already applied outside alembic)

Revision ID: abcdef123456
Revises: 1b2c3d4e5f6a
Create Date: 2025-07-28 12:00:00.000000

This revision is a no-op placeholder because the related schema changes
were applied via an earlier legacy migration path. Keeping it empty avoids
duplicate column errors when stamping the current state.
"""

revision = "abcdef123456"
down_revision = "1b2c3d4e5f6a"
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
