"""add invoices, invoice_line_items, payments tables

Revision ID: 1234abcd5678
Revises: 0f1e2d3c4b5a
Create Date: 2025-08-16
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "1234abcd5678"
down_revision = "0f1e2d3c4b5a"
branch_labels = None
depends_on = None

INVOICE_STATUS_ENUM = "invoice_status_enum"
PAYMENT_METHOD_ENUM = "payment_method_enum"


def upgrade():
    # Create enums
    invoice_status = postgresql.ENUM(
        "DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "VOID", name=INVOICE_STATUS_ENUM
    )
    payment_method = postgresql.ENUM(
        "CASH", "CARD", "CHECK", "ACH", "OTHER", name=PAYMENT_METHOD_ENUM
    )
    invoice_status.create(op.get_bind(), checkfirst=True)
    payment_method.create(op.get_bind(), checkfirst=True)

    # invoices table
    op.create_table(
        "invoices",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("appointment_id", sa.Text(), nullable=True),
        sa.Column("customer_id", sa.Text(), nullable=True),
        sa.Column("vehicle_id", sa.Text(), nullable=True),
        sa.Column("status", invoice_status, nullable=False, server_default="DRAFT"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("subtotal_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tax_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("amount_paid_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("amount_due_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("issued_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("paid_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("voided_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.CheckConstraint("subtotal_cents >= 0"),
        sa.CheckConstraint("tax_cents >= 0"),
        sa.CheckConstraint("total_cents = subtotal_cents + tax_cents"),
        sa.CheckConstraint("amount_paid_cents >= 0"),
        sa.CheckConstraint("amount_paid_cents <= total_cents"),
        sa.CheckConstraint("amount_due_cents = total_cents - amount_paid_cents"),
        sa.UniqueConstraint("appointment_id", name="uq_invoices_appointment_id"),
    )
    op.create_foreign_key(
        "fk_invoices_appointment",
        "invoices",
        "appointments",
        ["appointment_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # invoice_line_items table
    op.create_table(
        "invoice_line_items",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("invoice_id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("service_operation_id", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("unit_price_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("line_subtotal_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tax_rate_basis_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tax_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["invoices.id"],
            name="fk_invoice_line_items_invoice",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["service_operation_id"],
            ["service_operations.id"],
            name="fk_invoice_line_items_service_op",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint("quantity > 0"),
        sa.CheckConstraint("unit_price_cents >= 0"),
        sa.CheckConstraint("line_subtotal_cents = unit_price_cents * quantity"),
        sa.CheckConstraint("tax_cents >= 0"),
        sa.CheckConstraint("total_cents = line_subtotal_cents + tax_cents"),
    )
    op.create_index(
        "idx_invoice_line_items_invoice", "invoice_line_items", ["invoice_id", "position"]
    )

    # payments table
    op.create_table(
        "payments",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("invoice_id", sa.Text(), nullable=False),
        sa.Column("method", payment_method, nullable=False),
        sa.Column("external_ref", sa.Text(), nullable=True),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("received_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id"], ["invoices.id"], name="fk_payments_invoice", ondelete="CASCADE"
        ),
        sa.CheckConstraint("amount_cents > 0"),
    )
    op.create_index("idx_payments_invoice", "payments", ["invoice_id"])
    op.create_index("idx_payments_received_at", "payments", ["received_at"])

    # touch trigger for invoices.updated_at
    op.execute(
        """
        CREATE OR REPLACE FUNCTION trg_touch_invoices()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER t_invoices_updated
        BEFORE UPDATE ON invoices
        FOR EACH ROW EXECUTE PROCEDURE trg_touch_invoices();
        """
    )


def downgrade():
    op.execute("DROP TRIGGER IF EXISTS t_invoices_updated ON invoices;")
    op.execute("DROP FUNCTION IF EXISTS trg_touch_invoices();")

    op.drop_index("idx_payments_received_at", table_name="payments")
    op.drop_index("idx_payments_invoice", table_name="payments")
    op.drop_table("payments")

    op.drop_index("idx_invoice_line_items_invoice", table_name="invoice_line_items")
    op.drop_table("invoice_line_items")

    op.drop_constraint("fk_invoices_appointment", "invoices", type_="foreignkey")
    op.drop_table("invoices")

    payment_method = postgresql.ENUM(name=PAYMENT_METHOD_ENUM)
    invoice_status = postgresql.ENUM(name=INVOICE_STATUS_ENUM)
    payment_method.drop(op.get_bind(), checkfirst=True)
    invoice_status.drop(op.get_bind(), checkfirst=True)
