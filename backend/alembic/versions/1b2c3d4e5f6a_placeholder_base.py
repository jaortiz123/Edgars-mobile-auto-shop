"""placeholder base revision to satisfy dependency chain

Revision ID: 1b2c3d4e5f6a
Revises:
Create Date: 2025-08-16
"""

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

revision = "1b2c3d4e5f6a"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Intentionally empty; original migration applied outside alembic/versions.
    pass


def downgrade():
    pass
