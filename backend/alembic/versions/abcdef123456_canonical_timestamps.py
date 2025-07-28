"""canonical timestamps: add start_ts/end_ts columns, backfill and index

Revision ID: abcdef123456
Revises: 1b2c3d4e5f6a
Create Date: 2025-07-28 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = 'abcdef123456'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add canonical timestamp columns
    op.add_column('appointments', sa.Column('start_ts', sa.DateTime(timezone=True), nullable=True))
    op.add_column('appointments', sa.Column('end_ts', sa.DateTime(timezone=True), nullable=True))

    # Backfill start_ts from scheduled_date and scheduled_time fields
    op.execute(
        """
        UPDATE appointments
        SET start_ts = CASE
            WHEN scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL
                THEN (scheduled_date::timestamp + scheduled_time)
            WHEN scheduled_date IS NOT NULL
                THEN scheduled_date::timestamp
            ELSE NULL
        END
        """
    )

    # Backfill end_ts from legacy end column
    # Since there is no legacy end column, set end_ts equal to start_ts
    op.execute("UPDATE appointments SET end_ts = start_ts")

    # Create index on canonical start_ts
    op.create_index(op.f('ix_appointments_start_ts'), 'appointments', ['start_ts'])


def downgrade():
    # Drop index and columns
    op.drop_index(op.f('ix_appointments_start_ts'), table_name='appointments')
    op.drop_column('appointments', 'end_ts')
    op.drop_column('appointments', 'start_ts')
