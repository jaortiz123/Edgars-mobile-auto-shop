"""canonical timestamps: add start_ts/end_ts columns, backfill and index

Revision ID: abcdef123456
Revises: 1b2c3d4e5f6a
Create Date: 2025-07-28 12:00:00.000000

T-010: Canonical start_ts/end_ts migration with proper backfill logic
- Adds start_ts and end_ts TIMESTAMPTZ columns (nullable)
- Backfills start_ts from existing 'start' field (or scheduled_date + scheduled_time as fallback)
- Backfills end_ts from existing 'end' field
- Creates index on start_ts for performance
- Maintains legacy fields for backward compatibility
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = 'abcdef123456'
down_revision = '1b2c3d4e5f6a'
branch_labels = None
depends_on = None


def upgrade():
    # Add canonical timestamp columns (TIMESTAMPTZ for timezone awareness)
    op.add_column('appointments', sa.Column('start_ts', sa.DateTime(timezone=True), nullable=True))
    op.add_column('appointments', sa.Column('end_ts', sa.DateTime(timezone=True), nullable=True))

    # Backfill start_ts using COALESCE logic as specified in requirements
    # Priority: start_ts (if exists) -> start -> scheduled_date + scheduled_time -> scheduled_date
    op.execute(
        """
        UPDATE appointments
        SET start_ts = COALESCE(
            start_ts,
            start,
            CASE 
                WHEN scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL
                    THEN (scheduled_date::timestamp + scheduled_time)
                WHEN scheduled_date IS NOT NULL
                    THEN scheduled_date::timestamp
                ELSE NULL
            END
        )
        """
    )

    # Backfill end_ts using COALESCE logic
    # Priority: end_ts (if exists) -> "end" -> calculated from start_ts + default duration
    op.execute(
        """
        UPDATE appointments
        SET end_ts = COALESCE(
            end_ts,
            "end",
            start_ts + INTERVAL '1 hour'
        )
        WHERE start_ts IS NOT NULL
        """
    )

    # Create index on canonical start_ts for performance (as required by T-010)
    op.create_index(op.f('ix_appointments_start_ts'), 'appointments', ['start_ts'])


def downgrade():
    # Drop index and canonical timestamp columns
    op.drop_index(op.f('ix_appointments_start_ts'), table_name='appointments')
    op.drop_column('appointments', 'end_ts')
    op.drop_column('appointments', 'start_ts')
