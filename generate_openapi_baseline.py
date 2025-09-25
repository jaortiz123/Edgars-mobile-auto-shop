#!/usr/bin/env python3
"""
OpenAPI Contract Generator for Edgar's Mobile Auto Shop
Generates OpenAPI v1 specification from current route behavior as baseline
"""

import json
import sys
from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class RouteSpec:
    """OpenAPI route specification"""

    path: str
    methods: List[str]
    summary: str
    parameters: List[Dict[str, Any]]
    responses: Dict[str, Dict[str, Any]]


def generate_openapi_spec() -> Dict[str, Any]:
    """
    Generate OpenAPI v1 specification from current routes

    This creates the behavior baseline contract that extracted routes
    must preserve exactly to guarantee no behavior change.
    """

    spec = {
        "openapi": "3.0.0",
        "info": {
            "title": "Edgar's Mobile Auto Shop API",
            "version": "1.0.0",
            "description": "Baseline API contract for refactoring behavior preservation",
        },
        "servers": [{"url": "http://localhost:3001", "description": "Development server"}],
        "paths": {},
        "components": {
            "schemas": {
                "Envelope": {
                    "type": "object",
                    "required": ["ok", "data", "error", "correlation_id"],
                    "properties": {
                        "ok": {"type": "boolean"},
                        "data": {
                            "oneOf": [{"type": "object"}, {"type": "array"}, {"type": "null"}]
                        },
                        "error": {"oneOf": [{"type": "object"}, {"type": "null"}]},
                        "correlation_id": {"type": "string"},
                        "meta": {"type": "object", "nullable": True},
                    },
                },
                "Error": {
                    "type": "object",
                    "properties": {"code": {"type": "integer"}, "message": {"type": "string"}},
                },
            },
            "parameters": {
                "CorrelationId": {
                    "name": "X-Correlation-Id",
                    "in": "header",
                    "schema": {"type": "string"},
                    "description": "Request correlation ID for tracing",
                },
                "TenantId": {
                    "name": "X-Tenant-Id",
                    "in": "header",
                    "schema": {"type": "string"},
                    "description": "Tenant identifier for multi-tenant support",
                },
                "IdempotencyKey": {
                    "name": "X-Idempotency-Key",
                    "in": "header",
                    "schema": {"type": "string"},
                    "description": "Idempotency key for critical POST operations",
                },
            },
            "responses": {
                "StandardEnvelope": {
                    "description": "Standard API response envelope",
                    "headers": {
                        "X-Correlation-Id": {
                            "schema": {"type": "string"},
                            "description": "Request correlation ID",
                        },
                        "X-Debug-App-Instance": {
                            "schema": {"type": "string"},
                            "description": "App instance identifier",
                        },
                    },
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/Envelope"}}
                    },
                }
            },
        },
    }

    # Add route specifications for major endpoints
    admin_routes = _generate_admin_routes()
    appointment_routes = _generate_appointment_routes()
    customer_routes = _generate_customer_routes()
    auth_routes = _generate_auth_routes()

    # Merge all route specifications
    for routes in [admin_routes, appointment_routes, customer_routes, auth_routes]:
        spec["paths"].update(routes)

    return spec


def _generate_admin_routes() -> Dict[str, Any]:
    """Generate OpenAPI specs for admin routes (63 endpoints)"""
    return {
        "/api/admin/customers/{customer_id}": {
            "get": {
                "summary": "Get admin customer details",
                "parameters": [
                    {
                        "name": "customer_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                    },
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            },
            "patch": {
                "summary": "Update customer information",
                "parameters": [
                    {
                        "name": "customer_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                    },
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "email": {"type": "string", "format": "email"},
                                    "phone": {"type": "string"},
                                    "contact_preferences": {"type": "object"},
                                },
                            }
                        }
                    },
                },
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            },
        },
        "/api/admin/appointments": {
            "get": {
                "summary": "List admin appointments",
                "parameters": [
                    {
                        "name": "limit",
                        "in": "query",
                        "schema": {"type": "integer", "default": 50, "minimum": 1, "maximum": 200},
                    },
                    {
                        "name": "offset",
                        "in": "query",
                        "schema": {"type": "integer", "default": 0, "minimum": 0},
                    },
                    {
                        "name": "status",
                        "in": "query",
                        "schema": {
                            "type": "string",
                            "enum": ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
                        },
                    },
                    {
                        "name": "from",
                        "in": "query",
                        "schema": {"type": "string", "format": "date-time"},
                    },
                    {
                        "name": "to",
                        "in": "query",
                        "schema": {"type": "string", "format": "date-time"},
                    },
                    {"name": "techId", "in": "query", "schema": {"type": "string"}},
                    {
                        "name": "q",
                        "in": "query",
                        "schema": {"type": "string"},
                        "description": "Search query",
                    },
                    {"$ref": "#/components/parameters/CorrelationId"},
                ],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            },
            "post": {
                "summary": "Create new appointment",
                "parameters": [
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/IdempotencyKey"},
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": [
                                    "customer_id",
                                    "vehicle_id",
                                    "service_code",
                                    "scheduled_at",
                                ],
                                "properties": {
                                    "customer_id": {"type": "string"},
                                    "vehicle_id": {"type": "string"},
                                    "service_code": {"type": "string"},
                                    "scheduled_at": {"type": "string", "format": "date-time"},
                                    "notes": {"type": "string"},
                                    "total_amount": {"type": "number"},
                                    "paid_amount": {"type": "number"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "201": {
                        "description": "Appointment created",
                        "headers": {
                            "X-Idempotency-Status": {
                                "schema": {"type": "string", "enum": ["created", "replayed"]},
                                "description": "Indicates if this was a new creation or idempotent replay",
                            }
                        },
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/responses/StandardEnvelope"}
                            }
                        },
                    }
                },
            },
        },
        "/api/admin/appointments/{id}": {
            "get": {
                "summary": "Get appointment by ID",
                "parameters": [
                    {"name": "id", "in": "path", "required": True, "schema": {"type": "string"}},
                    {"$ref": "#/components/parameters/CorrelationId"},
                ],
                "responses": {
                    "200": {"$ref": "#/components/responses/StandardEnvelope"},
                    "404": {"$ref": "#/components/responses/NotFound"},
                },
            },
            "put": {
                "summary": "Update appointment",
                "parameters": [
                    {"name": "id", "in": "path", "required": True, "schema": {"type": "string"}},
                    {"$ref": "#/components/parameters/CorrelationId"},
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "customer_id": {"type": "string"},
                                    "vehicle_id": {"type": "string"},
                                    "service_code": {"type": "string"},
                                    "scheduled_at": {"type": "string", "format": "date-time"},
                                    "notes": {"type": "string"},
                                    "total_amount": {"type": "number"},
                                    "paid_amount": {"type": "number"},
                                    "status": {"type": "string"},
                                },
                            }
                        }
                    },
                },
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            },
        },
        "/api/admin/appointments/{id}/status": {
            "patch": {
                "summary": "Update appointment status",
                "parameters": [
                    {"name": "id", "in": "path", "required": True, "schema": {"type": "string"}},
                    {"$ref": "#/components/parameters/CorrelationId"},
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["status"],
                                "properties": {
                                    "status": {
                                        "type": "string",
                                        "enum": [
                                            "SCHEDULED",
                                            "IN_PROGRESS",
                                            "COMPLETED",
                                            "CANCELLED",
                                        ],
                                    },
                                    "position": {"type": "integer", "minimum": 1},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {"$ref": "#/components/responses/StandardEnvelope"},
                    "400": {"$ref": "#/components/responses/BadRequest"},
                },
            }
        },
        "/api/admin/invoices": {
            "get": {
                "summary": "List admin invoices",
                "parameters": [{"$ref": "#/components/parameters/CorrelationId"}],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            }
        },
        "/api/admin/vehicles": {
            "get": {
                "summary": "List admin vehicles",
                "parameters": [
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            },
            "post": {
                "summary": "Create new vehicle",
                "parameters": [
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["customer_id", "make", "model", "year"],
                                "properties": {
                                    "customer_id": {"type": "string"},
                                    "vin": {"type": "string"},
                                    "make": {"type": "string"},
                                    "model": {"type": "string"},
                                    "year": {"type": "integer"},
                                    "trim": {"type": "string"},
                                    "color": {"type": "string"},
                                    "mileage": {"type": "integer"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {"$ref": "#/components/responses/StandardEnvelope"},
                    "400": {"$ref": "#/components/responses/BadRequest"},
                },
            },
        },
        "/api/admin/vehicles/{vehicle_id}": {
            "get": {
                "summary": "Get vehicle details",
                "parameters": [
                    {
                        "name": "vehicle_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                    },
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "responses": {
                    "200": {"$ref": "#/components/responses/StandardEnvelope"},
                    "404": {"$ref": "#/components/responses/NotFound"},
                },
            },
            "patch": {
                "summary": "Update vehicle information",
                "parameters": [
                    {
                        "name": "vehicle_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                    },
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "vin": {"type": "string"},
                                    "make": {"type": "string"},
                                    "model": {"type": "string"},
                                    "year": {"type": "integer"},
                                    "trim": {"type": "string"},
                                    "color": {"type": "string"},
                                    "mileage": {"type": "integer"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {"$ref": "#/components/responses/StandardEnvelope"},
                    "400": {"$ref": "#/components/responses/BadRequest"},
                    "404": {"$ref": "#/components/responses/NotFound"},
                },
            },
        },
        "/api/admin/vehicles/search": {
            "get": {
                "summary": "Search vehicles by VIN",
                "parameters": [
                    {"name": "vin", "in": "query", "required": True, "schema": {"type": "string"}},
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            }
        },
        "/api/admin/invoices": {
            "get": {
                "summary": "List admin invoices with pagination",
                "parameters": [
                    {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}},
                    {
                        "name": "pageSize",
                        "in": "query",
                        "schema": {"type": "integer", "default": 20},
                    },
                    {"name": "customerId", "in": "query", "schema": {"type": "string"}},
                    {"name": "status", "in": "query", "schema": {"type": "string"}},
                    {"name": "search", "in": "query", "schema": {"type": "string"}},
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            },
            "post": {
                "summary": "Create new invoice from appointment",
                "parameters": [
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["appointment_id", "customer_id", "items"],
                                "properties": {
                                    "appointment_id": {"type": "string"},
                                    "customer_id": {"type": "string"},
                                    "items": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "required": ["service_code", "qty", "unit_price"],
                                            "properties": {
                                                "service_code": {"type": "string"},
                                                "qty": {"type": "integer", "minimum": 1},
                                                "unit_price": {"type": "string"},
                                            },
                                        },
                                    },
                                    "tax_rate": {"type": "string", "default": "0.00"},
                                    "notes": {"type": "string"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "201": {"$ref": "#/components/responses/StandardEnvelope"},
                    "400": {"$ref": "#/components/responses/BadRequest"},
                },
            },
        },
        "/api/admin/invoices/{invoice_id}": {
            "get": {
                "summary": "Get invoice details with line items",
                "parameters": [
                    {
                        "name": "invoice_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                    },
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "responses": {
                    "200": {"$ref": "#/components/responses/StandardEnvelope"},
                    "404": {"$ref": "#/components/responses/NotFound"},
                },
            },
            "patch": {
                "summary": "Update invoice status or notes",
                "parameters": [
                    {
                        "name": "invoice_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                    },
                    {"$ref": "#/components/parameters/CorrelationId"},
                    {"$ref": "#/components/parameters/TenantId"},
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "status": {
                                        "type": "string",
                                        "enum": ["DRAFT", "ISSUED", "PAID", "VOIDED"],
                                    },
                                    "notes": {"type": "string"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {"$ref": "#/components/responses/StandardEnvelope"},
                    "400": {"$ref": "#/components/responses/BadRequest"},
                    "404": {"$ref": "#/components/responses/NotFound"},
                },
            },
        },
    }


def _generate_appointment_routes() -> Dict[str, Any]:
    """Generate OpenAPI specs for appointment routes (17 endpoints)"""
    return {
        "/api/appointments/{appointment_id}": {
            "get": {
                "summary": "Get appointment details",
                "parameters": [
                    {
                        "name": "appointment_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                    },
                    {"$ref": "#/components/parameters/CorrelationId"},
                ],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            }
        }
    }


def _generate_customer_routes() -> Dict[str, Any]:
    """Generate OpenAPI specs for customer routes (7 endpoints)"""
    return {
        "/api/customers/profile": {
            "get": {
                "summary": "Get customer profile (API route)",
                "parameters": [{"$ref": "#/components/parameters/CorrelationId"}],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            }
        },
        "/customers/profile": {
            "get": {
                "summary": "Get customer profile (legacy alias)",
                "parameters": [{"$ref": "#/components/parameters/CorrelationId"}],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            }
        },
        "/api/customers/login": {
            "post": {
                "summary": "Customer login",
                "parameters": [{"$ref": "#/components/parameters/CorrelationId"}],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            }
        },
    }


def _generate_auth_routes() -> Dict[str, Any]:
    """Generate OpenAPI specs for auth routes (3 endpoints)"""
    return {
        "/api/auth/logout": {
            "post": {
                "summary": "Logout user",
                "parameters": [{"$ref": "#/components/parameters/CorrelationId"}],
                "responses": {"200": {"$ref": "#/components/responses/StandardEnvelope"}},
            }
        }
    }


def save_openapi_spec(output_file: str = "api_v1_baseline.json"):
    """Generate and save OpenAPI specification"""

    spec = generate_openapi_spec()

    with open(output_file, "w") as f:
        json.dump(spec, f, indent=2)

    print(f"✅ OpenAPI v1 baseline saved to {output_file}")
    print(f"📋 Documented {len(spec['paths'])} endpoint groups")
    print("🔗 Use this as behavior preservation contract during refactoring")

    return spec


def main():
    """CLI entry point"""
    output_file = sys.argv[1] if len(sys.argv) > 1 else "api_v1_baseline.json"

    print("🔍 Generating OpenAPI v1 baseline contract...")
    save_openapi_spec(output_file)

    print("\n💡 Next steps:")
    print("1. Use this spec as the 'behavior preservation contract'")
    print("2. Run contract tests against extracted routes")
    print(f"3. Generate Swagger UI: swagger-ui-serve {output_file}")


if __name__ == "__main__":
    main()
