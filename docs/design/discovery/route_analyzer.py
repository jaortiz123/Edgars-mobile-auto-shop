#!/usr/bin/env python3
"""
Phase 0 Task 0.1 - Route Enumeration Script
===========================================

Systematically analyzes backend/local_server.py to extract all Flask routes,
their HTTP methods, parameters, authentication requirements, and dependencies.

This script builds the foundation for monolith refactoring by creating a
complete inventory of the current API surface.
"""

import argparse
import ast
import csv
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


@dataclass
class RouteInfo:
    """Complete route information"""

    path: str
    methods: List[str]
    function_name: str
    line_number: int
    docstring: Optional[str]
    parameters: List[str]
    auth_required: bool
    auth_type: Optional[str]
    dependencies: List[str]
    database_access: bool
    external_apis: List[str]
    error_handling: List[str]
    response_format: str
    complexity_score: int


class RouteAnalyzer:
    """Analyzes Flask routes in the monolith"""

    def __init__(self, server_file_path: str):
        self.server_path = Path(server_file_path)
        self.routes: List[RouteInfo] = []
        self.dependencies_map: Dict[str, Set[str]] = {}
        self.total_lines: int = 0
        self.analysis_timestamp: str = ""

    def analyze(self) -> Dict[str, Any]:
        """Main analysis entry point"""
        print("🔍 Phase 0 Task 0.1: Analyzing monolith routes...")

        if not self.server_path.exists():
            raise FileNotFoundError(f"Server file not found: {self.server_path}")

        # Read and parse the Python file
        with open(self.server_path, encoding="utf-8") as f:
            content = f.read()

        tree = ast.parse(content)
        self.total_lines = len(content.splitlines())
        self.analysis_timestamp = datetime.utcnow().isoformat()

        # Extract all route information
        self._extract_routes(tree, content)

        # Generate analysis report
        return self._generate_report()

    def _extract_routes(self, tree: ast.AST, content: str) -> None:
        """Extract all Flask routes from AST"""
        lines = content.split("\n")

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                route_info = self._analyze_function(node, lines)
                if route_info:
                    self.routes.append(route_info)

    def _analyze_function(
        self, func_node: ast.FunctionDef, lines: List[str]
    ) -> Optional[RouteInfo]:
        """Analyze a function to see if it's a Flask route"""

        # Look for @app.route decorator
        route_decorator = None
        for decorator in func_node.decorator_list:
            if self._is_route_decorator(decorator):
                route_decorator = decorator
                break

        if not route_decorator:
            return None

        # Extract route information
        path, methods = self._extract_route_params(route_decorator)

        # Analyze function body
        docstring = ast.get_docstring(func_node)
        parameters = self._extract_parameters(func_node)
        auth_info = self._analyze_auth(func_node, lines)
        dependencies = self._analyze_dependencies(func_node)
        db_access = self._has_database_access(func_node)
        external_apis = self._find_external_apis(func_node)
        error_handling = self._analyze_error_handling(func_node)
        response_format = self._determine_response_format(func_node)
        complexity = self._calculate_complexity(func_node)

        return RouteInfo(
            path=path,
            methods=methods,
            function_name=func_node.name,
            line_number=func_node.lineno,
            docstring=docstring,
            parameters=parameters,
            auth_required=auth_info["required"],
            auth_type=auth_info["type"],
            dependencies=sorted(dependencies),
            database_access=db_access,
            external_apis=external_apis,
            error_handling=error_handling,
            response_format=response_format,
            complexity_score=complexity,
        )

    def _is_route_decorator(self, decorator: ast.expr) -> bool:
        """Check if decorator is a Flask route decorator"""
        if isinstance(decorator, ast.Call):
            if isinstance(decorator.func, ast.Attribute):
                return (
                    decorator.func.attr == "route"
                    and isinstance(decorator.func.value, ast.Name)
                    and decorator.func.value.id == "app"
                )
        elif isinstance(decorator, ast.Attribute):
            return (
                decorator.attr == "route"
                and isinstance(decorator.value, ast.Name)
                and decorator.value.id == "app"
            )
        return False

    def _extract_route_params(self, decorator: ast.expr) -> tuple:
        """Extract path and methods from route decorator"""
        path = "/"
        methods = ["GET"]

        if isinstance(decorator, ast.Call):
            # Extract path (first argument)
            if decorator.args:
                if isinstance(decorator.args[0], ast.Constant):
                    path = decorator.args[0].value
                elif isinstance(decorator.args[0], ast.Str):  # Python < 3.8
                    path = decorator.args[0].s

            # Extract methods from keyword arguments
            for keyword in decorator.keywords:
                if keyword.arg == "methods":
                    if isinstance(keyword.value, ast.List):
                        methods = []
                        for item in keyword.value.elts:
                            if isinstance(item, ast.Constant):
                                methods.append(item.value)
                            elif isinstance(item, ast.Str):  # Python < 3.8
                                methods.append(item.s)

        return path, methods

    def _extract_parameters(self, func_node: ast.FunctionDef) -> List[str]:
        """Extract function parameters"""
        return [arg.arg for arg in func_node.args.args if arg.arg != "self"]

    def _analyze_auth(self, func_node: ast.FunctionDef, lines: List[str]) -> Dict[str, Any]:
        """Analyze authentication requirements"""
        auth_info = {"required": False, "type": None}

        # Check decorators for auth
        for decorator in func_node.decorator_list:
            if isinstance(decorator, ast.Name):
                if "auth" in decorator.id.lower() or "login" in decorator.id.lower():
                    auth_info["required"] = True
                    auth_info["type"] = decorator.id
            elif isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Name):
                if "auth" in decorator.func.id.lower():
                    auth_info["required"] = True
                    auth_info["type"] = decorator.func.id

        # Check function body for auth checks
        for node in ast.walk(func_node):
            if isinstance(node, ast.Name) and "auth" in node.id.lower():
                auth_info["required"] = True
                if not auth_info["type"]:
                    auth_info["type"] = "manual_check"

        return auth_info

    def _analyze_dependencies(self, func_node: ast.FunctionDef) -> Set[str]:
        """Analyze function dependencies"""
        dependencies = set()

        for node in ast.walk(func_node):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    dependencies.add(node.func.id)
                elif isinstance(node.func, ast.Attribute):
                    if isinstance(node.func.value, ast.Name):
                        dependencies.add(f"{node.func.value.id}.{node.func.attr}")

        return dependencies

    def _has_database_access(self, func_node: ast.FunctionDef) -> bool:
        """Check if function accesses database"""
        db_indicators = [
            "cursor",
            "execute",
            "fetchone",
            "fetchall",
            "commit",
            "rollback",
            "db",
            "conn",
        ]

        for node in ast.walk(func_node):
            if isinstance(node, ast.Name) and node.id in db_indicators:
                return True
            elif isinstance(node, ast.Attribute) and node.attr in db_indicators:
                return True

        return False

    def _find_external_apis(self, func_node: ast.FunctionDef) -> List[str]:
        """Find external API calls"""
        external_apis = []
        api_indicators = ["requests", "urllib", "httpx", "aiohttp", "boto3"]

        for node in ast.walk(func_node):
            if isinstance(node, ast.Name) and node.id in api_indicators:
                external_apis.append(node.id)
            elif isinstance(node, ast.Attribute):
                if isinstance(node.value, ast.Name) and node.value.id in api_indicators:
                    external_apis.append(f"{node.value.id}.{node.attr}")

        return sorted(set(external_apis))

    def _analyze_error_handling(self, func_node: ast.FunctionDef) -> List[str]:
        """Analyze error handling patterns"""
        error_patterns = []

        for node in ast.walk(func_node):
            if isinstance(node, ast.Try):
                error_patterns.append("try-except")
            elif isinstance(node, ast.Raise):
                error_patterns.append("raise")
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id == "abort":
                    error_patterns.append("flask-abort")

        return list(set(error_patterns))

    def _determine_response_format(self, func_node: ast.FunctionDef) -> str:
        """Determine response format"""
        for node in ast.walk(func_node):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id == "jsonify":
                        return "json"
                    elif node.func.id == "render_template":
                        return "html"
                    elif node.func.id == "make_response":
                        return "custom"

        return "unknown"

    def _calculate_complexity(self, func_node: ast.FunctionDef) -> int:
        """Calculate cyclomatic complexity"""
        complexity = 1  # Base complexity

        for node in ast.walk(func_node):
            if isinstance(node, (ast.If, ast.While, ast.For, ast.Try)):
                complexity += 1
            elif isinstance(node, ast.BoolOp):
                complexity += len(node.values) - 1

        return complexity

    def _generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive analysis report"""

        # Basic statistics
        total_routes = len(self.routes)
        methods_count = {}
        auth_routes = 0
        db_routes = 0

        for route in self.routes:
            for method in route.methods:
                methods_count[method] = methods_count.get(method, 0) + 1
            if route.auth_required:
                auth_routes += 1
            if route.database_access:
                db_routes += 1

        # Complexity analysis
        complexities = [route.complexity_score for route in self.routes]
        avg_complexity = sum(complexities) / len(complexities) if complexities else 0

        # Route grouping by path prefix
        path_groups = {}
        for route in self.routes:
            prefix = "/" + route.path.strip("/").split("/")[0] if route.path != "/" else "root"
            if prefix not in path_groups:
                path_groups[prefix] = []
            path_groups[prefix].append(route.path)

        report = {
            "analysis_metadata": {
                "timestamp": self.analysis_timestamp,
                "monolith_file": str(self.server_path),
                "total_lines_analyzed": self.total_lines,
                "phase": "Phase 0 Task 0.1",
            },
            "route_inventory": {
                "total_routes": total_routes,
                "http_methods_distribution": methods_count,
                "authentication_summary": {
                    "total_auth_routes": auth_routes,
                    "total_open_routes": total_routes - auth_routes,
                    "auth_percentage": (
                        round((auth_routes / total_routes) * 100, 1) if total_routes > 0 else 0
                    ),
                },
                "database_access": {
                    "routes_with_db_access": db_routes,
                    "db_access_percentage": (
                        round((db_routes / total_routes) * 100, 1) if total_routes > 0 else 0
                    ),
                },
            },
            "complexity_analysis": {
                "average_complexity": round(avg_complexity, 2),
                "min_complexity": min(complexities) if complexities else 0,
                "max_complexity": max(complexities) if complexities else 0,
                "high_complexity_routes": [
                    {"path": r.path, "function": r.function_name, "complexity": r.complexity_score}
                    for r in self.routes
                    if r.complexity_score > 10
                ],
            },
            "path_groupings": {group: len(paths) for group, paths in sorted(path_groups.items())},
            "detailed_routes": [asdict(route) for route in self.routes],
        }

        return report


def main():
    """Execute route analysis"""
    parser = argparse.ArgumentParser(description="Analyze Flask routes in a monolith server file")
    parser.add_argument(
        "server_file",
        nargs="?",
        default="backend/local_server.py",
        help="Path to the monolith server file (default: backend/local_server.py)",
    )
    args = parser.parse_args()

    analyzer = RouteAnalyzer(args.server_file)
    report = analyzer.analyze()

    # Ensure output directory exists
    output_dir = Path("docs/design/discovery")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save detailed report (JSON)
    json_path = output_dir / "route_inventory.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    # Save CSV summary for compatibility with Phase 0 plan
    csv_path = output_dir / "route_inventory.csv"
    csv_columns = ["method", "path", "function", "file", "line", "auth_required", "auth_type"]

    with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=csv_columns)
        writer.writeheader()
        for route in report["detailed_routes"]:
            for method in route["methods"]:
                writer.writerow(
                    {
                        "method": method,
                        "path": route["path"],
                        "function": route["function_name"],
                        "file": str(Path(args.server_file)),
                        "line": route["line_number"],
                        "auth_required": route["auth_required"],
                        "auth_type": route["auth_type"] or "",
                    }
                )

    # Print summary
    print("\n📊 Route Analysis Complete!")
    print(f"Total Routes Found: {report['route_inventory']['total_routes']}")
    print(
        f"Authentication Coverage: {report['route_inventory']['authentication_summary']['auth_percentage']}%"
    )
    print(
        f"Database Access: {report['route_inventory']['database_access']['db_access_percentage']}%"
    )
    print(f"Average Complexity: {report['complexity_analysis']['average_complexity']}")
    print(f"High Complexity Routes: {len(report['complexity_analysis']['high_complexity_routes'])}")
    print(f"\n📁 JSON report saved to: {json_path}")
    print(f"📁 CSV summary saved to: {csv_path}")

    # Show path groupings
    print("\n📂 Route Groups by Path Prefix:")
    for group, count in report["path_groupings"].items():
        print(f"  {group}: {count} routes")


if __name__ == "__main__":
    main()
