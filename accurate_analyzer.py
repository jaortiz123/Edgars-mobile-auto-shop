#!/usr/bin/env python3
"""
Accurate Server Structure Analyzer using AST introspection
Fixes the regex-based inconsistencies in the original analysis
"""

import ast
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from typing import List, Optional, Set, Tuple


@dataclass
class RouteInfo:
    path: str
    methods: List[str]
    function_name: str
    line_number: int
    decorator_full: str


@dataclass
class FunctionInfo:
    name: str
    line_number: int
    args: List[str]
    is_route_handler: bool
    decorators: List[str]


@dataclass
class AnalysisResult:
    total_lines: int
    non_empty_lines: int
    comment_lines: int
    routes: List[RouteInfo]
    functions: List[FunctionInfo]
    classes: List[str]
    imports: Set[str]
    sql_operations: List[Tuple[int, str, str]]  # line, keyword, context


class FlaskRouteVisitor(ast.NodeVisitor):
    """AST visitor to extract Flask routes and functions accurately"""

    def __init__(self, source_lines: List[str]):
        self.source_lines = source_lines
        self.routes: List[RouteInfo] = []
        self.functions: List[FunctionInfo] = []
        self.classes: List[str] = []
        self.imports: Set[str] = set()

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.add(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            for alias in node.names:
                if alias.name == "*":
                    self.imports.add(f"{node.module}.*")
                else:
                    self.imports.add(f"{node.module}.{alias.name}")
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        self.classes.append(node.name)
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        # Extract function info
        args = [arg.arg for arg in node.args.args]
        decorators = []
        is_route_handler = False
        route_info = None

        # Check decorators
        for decorator in node.decorator_list:
            decorator_str = self._ast_to_string(decorator)
            decorators.append(decorator_str)

            # Check if it's a Flask route
            if self._is_flask_route_decorator(decorator):
                is_route_handler = True
                route_info = self._extract_route_info(decorator, node)

        func_info = FunctionInfo(
            name=node.name,
            line_number=node.lineno,
            args=args,
            is_route_handler=is_route_handler,
            decorators=decorators,
        )
        self.functions.append(func_info)

        # Add route info if this is a route handler
        if route_info:
            self.routes.append(route_info)

        self.generic_visit(node)

    def _ast_to_string(self, node: ast.AST) -> str:
        """Convert AST node back to string representation"""
        try:
            return ast.unparse(node)
        except:
            # Fallback for older Python versions
            if isinstance(node, ast.Name):
                return node.id
            elif isinstance(node, ast.Attribute):
                return f"{self._ast_to_string(node.value)}.{node.attr}"
            elif isinstance(node, ast.Call):
                func_name = self._ast_to_string(node.func)
                args = [self._ast_to_string(arg) for arg in node.args]
                return f"{func_name}({', '.join(args)})"
            else:
                return str(type(node).__name__)

    def _is_flask_route_decorator(self, decorator: ast.AST) -> bool:
        """Check if decorator is a Flask route"""
        decorator_str = self._ast_to_string(decorator)
        return "app.route" in decorator_str or "@app.route" in decorator_str

    def _extract_route_info(
        self, decorator: ast.AST, func_node: ast.FunctionDef
    ) -> Optional[RouteInfo]:
        """Extract route information from @app.route decorator"""
        try:
            if isinstance(decorator, ast.Call):
                # Get the route path (first argument)
                path = "unknown"
                methods = ["GET"]  # default

                if decorator.args:
                    first_arg = decorator.args[0]
                    if isinstance(first_arg, ast.Constant):
                        path = first_arg.value
                    elif isinstance(first_arg, ast.Str):  # Python < 3.8
                        path = first_arg.s

                # Look for methods keyword argument
                for keyword in decorator.keywords:
                    if keyword.arg == "methods":
                        if isinstance(keyword.value, ast.List):
                            methods = []
                            for elt in keyword.value.elts:
                                if isinstance(elt, ast.Constant):
                                    methods.append(elt.value)
                                elif isinstance(elt, ast.Str):  # Python < 3.8
                                    methods.append(elt.s)

                return RouteInfo(
                    path=path,
                    methods=methods,
                    function_name=func_node.name,
                    line_number=func_node.lineno,
                    decorator_full=self._ast_to_string(decorator),
                )
        except Exception as e:
            print(f"Warning: Could not parse route decorator at line {func_node.lineno}: {e}")

        return None


def analyze_sql_operations(source_lines: List[str]) -> List[Tuple[int, str, str]]:
    """Find SQL operations in source code"""
    sql_keywords = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"]
    operations = []

    for i, line in enumerate(source_lines, 1):
        line_upper = line.upper()
        for keyword in sql_keywords:
            if keyword in line_upper:
                # Get context (truncated line)
                context = line.strip()[:80]
                if len(line.strip()) > 80:
                    context += "..."
                operations.append((i, keyword, context))
                break  # Only count first SQL keyword per line

    return operations


def analyze_file_structure(filepath: str) -> AnalysisResult:
    """Main analysis function using AST parsing"""

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    with open(filepath, encoding="utf-8") as f:
        source = f.read()
        source_lines = source.split("\n")

    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        print(f"Syntax error in {filepath}: {e}")
        raise

    # Use visitor to extract information
    visitor = FlaskRouteVisitor(source_lines)
    visitor.visit(tree)

    # Analyze SQL operations
    sql_ops = analyze_sql_operations(source_lines)

    # Calculate file stats
    non_empty_lines = len([l for l in source_lines if l.strip()])
    comment_lines = len([l for l in source_lines if l.strip().startswith("#")])

    return AnalysisResult(
        total_lines=len(source_lines),
        non_empty_lines=non_empty_lines,
        comment_lines=comment_lines,
        routes=visitor.routes,
        functions=visitor.functions,
        classes=visitor.classes,
        imports=visitor.imports,
        sql_operations=sql_ops,
    )


def print_accurate_analysis(result: AnalysisResult):
    """Print consistent, accurate analysis"""

    print("🎯 " + "=" * 60)
    print("📊 ACCURATE SERVER ANALYSIS (AST-based)")
    print("🎯 " + "=" * 60)
    print(f"📏 Total Lines: {result.total_lines:,}")
    print(f"📝 Non-empty Lines: {result.non_empty_lines:,}")
    print(f"💬 Comment Lines: {result.comment_lines:,}")

    print(f"\n🛣️ ROUTES ANALYSIS ({len(result.routes)} total)")
    print("=" * 50)

    # Group routes by domain
    route_domains = defaultdict(list)
    for route in result.routes:
        parts = route.path.strip("/").split("/")
        if parts and parts[0]:
            domain = parts[1] if len(parts) > 1 and parts[0] == "api" else parts[0]
            route_domains[domain].append(route)

    for domain, routes in sorted(route_domains.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"  📂 /{domain}/*: {len(routes)} endpoints")
        for route in sorted(routes, key=lambda r: r.path)[:3]:
            methods_str = ",".join(route.methods)
            print(f"     {methods_str:8} {route.path}")
        if len(routes) > 3:
            print(f"     ... and {len(routes)-3} more")
        print()

    print(f"\n⚙️ FUNCTIONS ANALYSIS ({len(result.functions)} total)")
    print("=" * 50)
    route_handlers = [f for f in result.functions if f.is_route_handler]
    utility_functions = [f for f in result.functions if not f.is_route_handler]

    print(f"🛣️ Route Handlers: {len(route_handlers)}")
    print(f"🔧 Utility Functions: {len(utility_functions)}")
    print(f"🏗️ Classes: {len(result.classes)}")

    print(f"\n🗄️ SQL OPERATIONS ({len(result.sql_operations)} total)")
    print("=" * 50)
    sql_by_keyword = defaultdict(int)
    for _, keyword, _ in result.sql_operations:
        sql_by_keyword[keyword] += 1

    for keyword, count in sorted(sql_by_keyword.items()):
        print(f"  {keyword}: {count} operations")

    print(f"\n📦 IMPORTS ({len(result.imports)} unique)")
    print("=" * 50)

    # Categorize imports
    flask_imports = [imp for imp in result.imports if "flask" in imp.lower()]
    db_imports = [
        imp
        for imp in result.imports
        if any(db in imp.lower() for db in ["psycopg2", "sqlalchemy", "sqlite", "mongo"])
    ]

    if flask_imports:
        print(f"  🌶️ Flask: {len(flask_imports)} imports")
    if db_imports:
        print(f"  🗄️ Database: {len(db_imports)} imports")

    print("\n🎯 EXTRACTION PRIORITIES")
    print("=" * 50)
    print("1. 🏗️ App Factory + Middleware (bootstrap foundation)")
    print("2. 📋 OpenAPI Contract (behavior baseline)")
    print("3. 🔌 DI Seams (repository interfaces)")

    # Show biggest domains for extraction
    if route_domains:
        biggest_domain = max(route_domains.items(), key=lambda x: len(x[1]))
        print(f"4. 🎯 Start with /{biggest_domain[0]}/* ({len(biggest_domain[1])} routes)")


def main():
    filepath = sys.argv[1] if len(sys.argv) > 1 else "backend/local_server.py"

    print(f"🔍 Analyzing: {filepath}")
    print()

    try:
        result = analyze_file_structure(filepath)
        print_accurate_analysis(result)

        # Save results for other tools
        print("\n💾 Results saved to analysis_result.json for other tools to use")

    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
