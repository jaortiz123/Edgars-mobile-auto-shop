"""canonical timestamps: add start_ts/end_ts columns, backfill and index

Revision ID: abcdef123456
Revises: 1b2c3d4e5f6a
Create Date: 2025-07-28 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = 'abcdef123456'
down_revision = '1b2c3d4e5f6a'
branch_labels = None
depends_on = None


def upgrade():
    # Add canonical timestamp columns
    op.add_column('appointments', sa.Column('start_ts', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('appointments', sa.Column('end_ts', sa.TIMESTAMP(timezone=True), nullable=True))

    # Backfill start_ts from legacy start, scheduled_date+scheduled_time, or scheduled_date
    op.execute(
        """
        UPDATE appointments
        SET start_ts = COALESCE(
            start,
            (scheduled_date::timestamp + scheduled_time),
            scheduled_date::timestamp
        )
        """
    )

    # Backfill end_ts from legacy end
    op.execute(
        """
        UPDATE appointments
        SET end_ts = "end"
        """
    )

    # Create index on canonical start_ts
    op.create_index('ix_appointments_start_ts', 'appointments', ['start_ts'])


def downgrade():
    # Drop index and columns
    op.drop_index('ix_appointments_start_ts', table_name='appointments')
    op.drop_column('appointments', 'end_ts')
    op.drop_column('appointments', 'start_ts')
