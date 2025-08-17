import os
import psycopg2
import pytest


@pytest.mark.integration
def test_invoice_snapshot_trigger_populates_fields(pg_container):
    """Validate trigger populates snapshot columns during insert."""
    dsn = pg_container["db_url"]
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    # 1. Create a service_operation with category + (no subcategory yet) if not exists
    so_id = "snapshot-test-op"
    cur.execute(
        """
        INSERT INTO service_operations (id, name, category) VALUES (%s,'Snapshot Test Operation','SnapshotCat')
        ON CONFLICT (id) DO NOTHING
        """,
        (so_id,),
    )

    # 2. Insert invoice and line item referencing service_operation (trigger should fire)
    invoice_id = "inv_snapshot_test"
    cur.execute(
        """
        INSERT INTO invoices (id) VALUES (%s)
        ON CONFLICT (id) DO NOTHING
        """,
        (invoice_id,),
    )

    li_id = "li_snapshot_test"
    cur.execute("DELETE FROM invoice_line_items WHERE id=%s", (li_id,))
    cur.execute(
        """
        INSERT INTO invoice_line_items (
            id, invoice_id, position, service_operation_id, name, quantity,
            unit_price_cents, line_subtotal_cents, total_cents
        ) VALUES (%s,%s,1,%s,'Snapshot Line',1,0,0,0)
        """,
        (li_id, invoice_id, so_id),
    )
    conn.commit()

    # 3. Fetch and assert snapshot columns populated
    cur.execute(
        """
        SELECT service_operation_id, service_category, service_subcategory, service_internal_code
        FROM invoice_line_items WHERE id=%s
        """,
        (li_id,),
    )
    row = cur.fetchone()
    assert row is not None, "Line item not found"
    so_ref, cat, subcat, internal_code = row
    assert so_ref == so_id
    assert cat == "SnapshotCat"
    assert internal_code == so_id  # internal_code currently mirrors id
    # subcategory still optional (None) until backfill/enrichment

    cur.close()
    conn.close()
