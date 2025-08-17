"""add service_operations table and appointment links

Revision ID: 0f1e2d3c4b5a
Revises: abcdef123456
Create Date: 2025-08-14
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0f1e2d3c4b5a"
down_revision = "abcdef123456"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "service_operations",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("keywords", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("default_hours", sa.Numeric(5, 2)),
        sa.Column("default_price", sa.Numeric(10, 2)),
        sa.Column("flags", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("replaced_by_id", sa.Text(), nullable=True),
        sa.Column("labor_matrix_code", sa.Text(), nullable=True),
        sa.Column("skill_level", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["replaced_by_id"], ["service_operations.id"], name="fk_service_operations_replaced_by"
        ),
    )
    op.create_index("idx_service_operations_category", "service_operations", ["category"])

    with op.batch_alter_table("appointments") as batch_op:
        batch_op.add_column(sa.Column("primary_operation_id", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("service_category", sa.Text(), nullable=True))
        batch_op.create_foreign_key(
            "fk_appointments_primary_operation",
            "service_operations",
            ["primary_operation_id"],
            ["id"],
        )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION trg_touch_service_operations()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER t_service_operations_updated
        BEFORE UPDATE ON service_operations
        FOR EACH ROW EXECUTE PROCEDURE trg_touch_service_operations();
        """
    )


def downgrade():
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.drop_constraint("fk_appointments_primary_operation", type_="foreignkey")
        batch_op.drop_column("primary_operation_id")
        batch_op.drop_column("service_category")

    op.drop_index("idx_service_operations_category", table_name="service_operations")
    op.drop_table("service_operations")
    op.execute("DROP FUNCTION IF EXISTS trg_touch_service_operations();")
