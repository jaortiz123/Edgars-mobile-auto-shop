#!/usr/bin/env python3
"""
Server Structure Analyzer for Edgar's Mobile Auto Shop
Maps the 12,815-line local_server.py to understand refactoring opportunities
"""

import os
import re
from collections import defaultdict
from typing import Dict


def analyze_server_structure(filepath: str) -> Dict:
    """Comprehensive analysis of the Flask server structure"""

    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        return {}

    with open(filepath, encoding="utf-8") as f:
        content = f.read()
        lines = content.split("\n")

    results = {
        "file_stats": {},
        "routes": [],
        "route_groups": defaultdict(list),
        "functions": [],
        "sql_operations": [],
        "imports": [],
        "classes": [],
        "decorators": [],
        "error_handlers": [],
        "line_analysis": {},
    }

    # Basic file stats
    results["file_stats"] = {
        "total_lines": len(lines),
        "non_empty_lines": len([l for l in lines if l.strip()]),
        "comment_lines": len([l for l in lines if l.strip().startswith("#")]),
        "docstring_blocks": len(re.findall(r'""".*?"""', content, re.DOTALL)),
    }

    # Find all Flask routes
    route_pattern = r'@app\.route\([\'"]([^\'"]+)[\'"](?:.*?methods=\[([^\]]+)\])?.*?\)'
    routes = re.findall(route_pattern, content)

    for route_path, methods in routes:
        methods_clean = methods.replace("'", "").replace('"', "") if methods else "GET"
        results["routes"].append(
            {"path": route_path, "methods": methods_clean.split(", ") if methods else ["GET"]}
        )

        # Group by API prefix
        parts = route_path.strip("/").split("/")
        if parts and parts[0]:
            prefix = parts[1] if len(parts) > 1 and parts[0] == "api" else parts[0]
            results["route_groups"][prefix].append(route_path)

    # Find all function definitions with line numbers
    func_pattern = r"^(\s*)def\s+(\w+)\s*\([^)]*\):"
    for i, line in enumerate(lines, 1):
        match = re.match(func_pattern, line)
        if match:
            indent, func_name = match.groups()
            results["functions"].append(
                {
                    "name": func_name,
                    "line": i,
                    "indent_level": len(indent) // 4,  # Assume 4-space indents
                }
            )

    # Find SQL operations
    sql_keywords = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"]
    sql_pattern = r"(" + "|".join(sql_keywords) + r")\s+.*?(?:FROM|INTO|TABLE|SET|WHERE|VALUES)"

    for i, line in enumerate(lines, 1):
        for keyword in sql_keywords:
            if keyword in line.upper():
                # Context: show a bit of the line
                context = line.strip()[:80] + ("..." if len(line.strip()) > 80 else "")
                results["sql_operations"].append(
                    {"line": i, "keyword": keyword, "context": context}
                )
                break

    # Find imports
    import_patterns = [
        r"^from\s+([\w\.]+)\s+import",
        r"^import\s+([\w\.]+)",
    ]

    for pattern in import_patterns:
        matches = re.findall(pattern, content, re.MULTILINE)
        results["imports"].extend(matches)

    results["imports"] = list(set(results["imports"]))  # Remove duplicates

    # Find class definitions
    class_pattern = r"^class\s+(\w+)(?:\([^)]*\))?:"
    for i, line in enumerate(lines, 1):
        match = re.match(class_pattern, line)
        if match:
            results["classes"].append({"name": match.group(1), "line": i})

    # Find decorators (beyond @app.route)
    decorator_pattern = r"^@(\w+(?:\.\w+)*)"
    for i, line in enumerate(lines, 1):
        match = re.match(decorator_pattern, line.strip())
        if match and not line.strip().startswith("@app.route"):
            results["decorators"].append({"name": match.group(1), "line": i})

    # Find error handlers
    error_handler_pattern = r"@app\.errorhandler\((\d+)\)"
    error_handlers = re.findall(error_handler_pattern, content)
    results["error_handlers"] = error_handlers

    # Analyze line distribution
    line_ranges = {
        "imports_config": (1, 200),
        "helpers_utils": (201, 2000),
        "api_routes": (2001, 10000),
        "database_sql": (10001, 12000),
        "app_init": (12001, len(lines)),
    }

    for range_name, (start, end) in line_ranges.items():
        range_lines = lines[start - 1 : min(end, len(lines))]
        results["line_analysis"][range_name] = {
            "lines": len(range_lines),
            "functions": len([l for l in range_lines if l.strip().startswith("def ")]),
            "routes": len([l for l in range_lines if "@app.route" in l]),
            "sql": len([l for l in range_lines if any(kw in l.upper() for kw in sql_keywords)]),
        }

    return results


def print_analysis(results: Dict):
    """Print formatted analysis results"""

    if not results:
        return

    stats = results["file_stats"]
    print("🎯 " + "=" * 60)
    print("📊 EDGAR'S MOBILE AUTO SHOP - SERVER ANALYSIS")
    print("🎯 " + "=" * 60)
    print(f"📏 Total Lines: {stats['total_lines']:,}")
    print(f"📝 Non-empty Lines: {stats['non_empty_lines']:,}")
    print(f"💬 Comment Lines: {stats['comment_lines']:,}")
    print(f"📖 Docstring Blocks: {stats['docstring_blocks']}")

    print(f"\n🛣️ API ROUTES SUMMARY ({len(results['routes'])} total)")
    print("=" * 50)

    # Group routes by API domain
    route_groups = results["route_groups"]
    for group, paths in sorted(route_groups.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"  📂 /{group}/* : {len(paths)} endpoints")

        # Show first few examples
        for path in sorted(paths)[:3]:
            print(f"     - {path}")
        if len(paths) > 3:
            print(f"     ... and {len(paths)-3} more")
        print()

    print("\n⚙️ FUNCTIONS & STRUCTURE")
    print("=" * 50)
    print(f"🔧 Total Functions: {len(results['functions'])}")
    print(f"🏗️ Classes Defined: {len(results['classes'])}")
    print(f"🎨 Custom Decorators: {len(results['decorators'])}")
    print(f"❌ Error Handlers: {len(results['error_handlers'])}")

    print("\n🗄️ DATABASE OPERATIONS")
    print("=" * 50)
    sql_by_type = defaultdict(int)
    for op in results["sql_operations"]:
        sql_by_type[op["keyword"]] += 1

    for keyword, count in sorted(sql_by_type.items()):
        print(f"  {keyword}: {count} operations")

    print(f"\n📦 DEPENDENCIES ({len(results['imports'])} unique)")
    print("=" * 50)

    # Categorize imports
    flask_imports = [imp for imp in results["imports"] if "flask" in imp.lower()]
    db_imports = [
        imp
        for imp in results["imports"]
        if any(db in imp.lower() for db in ["sql", "psycopg", "sqlite", "mongo"])
    ]
    aws_imports = [
        imp for imp in results["imports"] if "boto" in imp.lower() or "aws" in imp.lower()
    ]
    auth_imports = [
        imp
        for imp in results["imports"]
        if any(auth in imp.lower() for auth in ["jwt", "auth", "crypto"])
    ]

    if flask_imports:
        print(
            f"  🌶️ Flask & Web: {', '.join(flask_imports[:3])}{'...' if len(flask_imports) > 3 else ''}"
        )
    if db_imports:
        print(f"  🗄️ Database: {', '.join(db_imports[:3])}{'...' if len(db_imports) > 3 else ''}")
    if aws_imports:
        print(f"  ☁️ AWS/Cloud: {', '.join(aws_imports[:3])}{'...' if len(aws_imports) > 3 else ''}")
    if auth_imports:
        print(
            f"  🔐 Auth/Security: {', '.join(auth_imports[:3])}{'...' if len(auth_imports) > 3 else ''}"
        )

    print("\n📐 CODE DISTRIBUTION")
    print("=" * 50)
    line_analysis = results["line_analysis"]
    for section, data in line_analysis.items():
        print(f"  📂 {section.replace('_', ' ').title()}: {data['lines']} lines")
        print(f"     Functions: {data['functions']}, Routes: {data['routes']}, SQL: {data['sql']}")
        print()


def suggest_refactoring_plan(results: Dict):
    """Generate refactoring suggestions based on analysis"""

    print("\n🔄 REFACTORING OPPORTUNITIES")
    print("=" * 60)

    route_groups = results["route_groups"]

    # Suggest module splits based on route groupings
    print("💡 Suggested Module Structure:")
    print()

    high_volume_groups = [(g, len(p)) for g, p in route_groups.items() if len(p) >= 5]
    medium_volume_groups = [(g, len(p)) for g, p in route_groups.items() if 2 <= len(p) < 5]

    for group, count in sorted(high_volume_groups, key=lambda x: x[1], reverse=True):
        print(f"📁 backend/routes/{group}_routes.py ({count} endpoints)")
        print(f"   ├── Handler functions for /{group}/* endpoints")
        print(f"   ├── Business logic specific to {group}")
        print(f"   └── {group.capitalize()}-specific validation/helpers")
        print()

    if medium_volume_groups:
        print("📁 backend/routes/misc_routes.py (smaller domains)")
        for group, count in medium_volume_groups:
            print(f"   ├── {group} ({count} endpoints)")
        print()

    # Suggest utility modules
    func_count = len(results["functions"])
    if func_count > 50:
        print("📁 backend/utils/")
        print("   ├── database.py (DB connection, queries, transactions)")
        print("   ├── auth.py (JWT, decorators, permission checks)")
        print("   ├── validation.py (Input validation, sanitization)")
        print("   ├── responses.py (Standard response formatting)")
        print("   └── helpers.py (General utilities)")
        print()

    # Suggest config module
    print("📁 backend/config/")
    print("   ├── settings.py (Environment variables, constants)")
    print("   ├── database.py (DB connection settings)")
    print("   └── logging.py (Logging configuration)")
    print()

    # Suggest main app structure
    print("📁 Simplified main app:")
    print("   ├── backend/app.py (Flask app factory)")
    print("   ├── backend/main.py (Entry point, imports all routes)")
    print("   └── backend/__init__.py (Package initialization)")
    print()

    print("🎯 REFACTORING PRIORITIES:")
    print("1. Extract authentication/authorization logic first")
    print("2. Split largest route groups (customers, appointments)")
    print("3. Create database utility module")
    print("4. Move configuration to separate module")
    print("5. Create app factory pattern for testability")


if __name__ == "__main__":
    import sys

    # Default to local_server.py in current directory
    filepath = "local_server.py"
    if len(sys.argv) > 1:
        filepath = sys.argv[1]

    print(f"🔍 Analyzing: {filepath}")
    print()

    results = analyze_server_structure(filepath)
    if results:
        print_analysis(results)
        suggest_refactoring_plan(results)

    print("\n✨ Analysis complete! Use this data to plan your refactoring strategy.")
