import pytest


@pytest.mark.integration
def test_service_operations_includes_new_fields_and_default_sort(client):
    resp = client.get("/api/admin/service-operations")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1
    sample = data[0]
    for key in [
        "id",
        "internal_code",
        "name",
        "category",
        "subcategory",
        "skill_level",
        "default_hours",
        "base_labor_rate",
        "keywords",
        "is_active",
        "display_order",
    ]:
        assert key in sample
    # Ascending order (non-null subset)
    orders = [row.get("display_order") for row in data if row.get("display_order") is not None]
    assert orders == sorted(orders)


@pytest.mark.integration
def test_service_operations_sort_desc(client):
    resp = client.get("/api/admin/service-operations?sort=display_order&dir=desc")
    assert resp.status_code == 200
    data = resp.get_json()
    orders = [row.get("display_order") for row in data if row.get("display_order") is not None]
    assert orders == sorted(orders, reverse=True)


@pytest.mark.integration
def test_service_operations_legacy_wrapper(client):
    """Ensure ?legacy=1 still returns wrapped object during transition."""
    resp = client.get("/api/admin/service-operations?legacy=1")
    assert resp.status_code == 200
    data = resp.get_json()
    # Legacy shape: object with service_operations key containing list
    assert isinstance(data, dict)
    assert "service_operations" in data
    assert isinstance(data["service_operations"], list)
    assert len(data["service_operations"]) >= 1
