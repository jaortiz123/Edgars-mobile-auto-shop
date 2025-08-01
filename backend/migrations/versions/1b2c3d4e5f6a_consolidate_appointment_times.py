"""consolidate_appointment_times

Revision ID: 1b2c3d4e5f6a
Revises: 
Create Date: 2025-07-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1b2c3d4e5f6a'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('appointments', sa.Column('start_ts', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('appointments', sa.Column('end_ts', sa.TIMESTAMP(timezone=True), nullable=True))
    op.execute("""
        UPDATE appointments
        SET start_ts = COALESCE(start, scheduled_date::timestamp + scheduled_time)
    """)
    op.execute("""
        UPDATE appointments
        SET end_ts = "end"
    """)
    op.drop_column('appointments', 'start')
    op.drop_column('appointments', 'end')
    op.drop_column('appointments', 'scheduled_date')
    op.drop_column('appointments', 'scheduled_time')
    op.alter_column('appointments', 'start_ts', new_column_name='start')
    op.alter_column('appointments', 'end_ts', new_column_name='end')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('appointments', sa.Column('scheduled_time', sa.TIME(), autoincrement=False, nullable=True))
    op.add_column('appointments', sa.Column('scheduled_date', sa.DATE(), autoincrement=False, nullable=True))
    op.add_column('appointments', sa.Column('end', sa.TIMESTAMP(), autoincrement=False, nullable=True))
    op.add_column('appointments', sa.Column('start', sa.TIMESTAMP(), autoincrement=False, nullable=True))
    op.drop_column('appointments', 'end')
    op.drop_column('appointments', 'start')
    # ### end Alembic commands ###
