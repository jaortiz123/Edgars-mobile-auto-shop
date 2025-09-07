#!/usr/bin/env python3
"""
Static Flask route -> auth guard scanner.

Parses backend/*.py files, finds @app.route decorators, and detects calls to
require_auth_role() (and vehicle_ownership_required decorator) inside the view
function body. Outputs:
  - audit_artifacts/flask_guard_scan.json
  - audit_artifacts/endpoint_auth_matrix.csv

No imports of the application are performed (safe, no side effects).
"""

from __future__ import annotations

import ast
import csv
import json
import os
import sys
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
ARTIFACTS_DIR = os.path.join(REPO_ROOT, "audit_artifacts")


@dataclass
class RouteDef:
    file: str
    line: int
    function: str
    rule: str
    methods: List[str]
    # Direct guards detected inside the view function (decorators/body)
    guards: List[str]
    has_require_auth: bool
    # After propagation through simple aliases (return other_function(...))
    effective_guards: List[str]
    effective_has_require_auth: bool


def _is_app_route_decorator(dec: ast.expr) -> Optional[Tuple[str, List[str]]]:
    """Return (rule, methods) if decorator is @app.route("/rule", methods=[...])."""
    if not isinstance(dec, ast.Call):
        return None
    # Expect something like app.route
    func = dec.func
    if not isinstance(func, ast.Attribute) or func.attr != "route":
        return None
    # Best-effort: only consider Name("app"). This covers our codebase.
    if not isinstance(func.value, ast.Name) or func.value.id != "app":
        return None

    rule = None
    if dec.args and isinstance(dec.args[0], (ast.Str, ast.Constant)):
        arg0 = dec.args[0]
        rule = arg0.s if isinstance(arg0, ast.Str) else arg0.value

    methods: List[str] = []
    for kw in dec.keywords or []:
        if kw.arg == "methods" and isinstance(kw.value, (ast.List, ast.Tuple)):
            for elt in kw.value.elts:
                if isinstance(elt, (ast.Str, ast.Constant)):
                    v = elt.s if isinstance(elt, ast.Str) else elt.value
                    if isinstance(v, str):
                        methods.append(v)

    if rule is None:
        return None
    return str(rule), methods


def _collect_calls(body: List[ast.stmt]) -> List[ast.Call]:
    calls: List[ast.Call] = []

    class Visitor(ast.NodeVisitor):
        def visit_Call(self, node: ast.Call) -> Any:  # type: ignore[override]
            calls.append(node)
            self.generic_visit(node)

    v = Visitor()
    for stmt in body:
        v.visit(stmt)
    return calls


def _detect_guards(body: List[ast.stmt], decorators: List[ast.expr]) -> Tuple[List[str], bool]:
    guards: List[str] = []
    has_require = False
    # Decorators: look for @vehicle_ownership_required
    for dec in decorators:
        # Could be Name("vehicle_ownership_required") or Call(Name(...))
        if isinstance(dec, ast.Name) and dec.id == "vehicle_ownership_required":
            guards.append("vehicle_ownership_required")
        elif (
            isinstance(dec, ast.Call)
            and isinstance(dec.func, ast.Name)
            and dec.func.id == "vehicle_ownership_required"
        ):
            guards.append("vehicle_ownership_required")

    # Body calls: require_auth_role(...)
    for call in _collect_calls(body):
        func = call.func
        name = None
        if isinstance(func, ast.Name):
            name = func.id
        elif isinstance(func, ast.Attribute):
            # Allow something like security.require_auth_role, though not expected here
            name = func.attr

        if name == "require_auth_role":
            has_require = True
            role_label = "Authenticated"
            if call.args:
                arg0 = call.args[0]
                if isinstance(arg0, (ast.Str, ast.Constant)):
                    v = arg0.s if isinstance(arg0, ast.Str) else arg0.value
                    if isinstance(v, str) and v:
                        role_label = f"role:{v}"
            guards.append(f"require_auth_role({role_label})")

    # Deduplicate guards while preserving order
    seen: set[str] = set()
    uniq = []
    for g in guards:
        if g not in seen:
            uniq.append(g)
            seen.add(g)
    return uniq, has_require


def scan_file(py_path: str) -> List[RouteDef]:
    with open(py_path, encoding="utf-8") as f:
        src = f.read()
    try:
        tree = ast.parse(src, filename=py_path)
    except SyntaxError as e:
        print(f"Skipping {py_path}: syntax error: {e}")
        return []

    # First pass: collect per-function direct guards and simple delegate targets
    func_info: Dict[str, Dict[str, Any]] = {}
    route_bindings: List[Tuple[str, int, str, List[str]]] = []  # (func_name, line, rule, methods)

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            # Direct guards
            guards, has_req = _detect_guards(node.body, node.decorator_list)

            # Simple delegate detection: if body is 'return <Name>(...)' (ignore leading docstring)
            delegate_to: Optional[str] = None
            stmts = [s for s in node.body]
            if (
                stmts
                and isinstance(stmts[0], ast.Expr)
                and isinstance(stmts[0].value, (ast.Str, ast.Constant))
                and isinstance(getattr(stmts[0], "value", None), (ast.Str, ast.Constant))
            ):
                # Likely a docstring expression; skip
                stmts = stmts[1:]
            if stmts and isinstance(stmts[0], ast.Return) and isinstance(stmts[0].value, ast.Call):
                cal = stmts[0].value
                if isinstance(cal.func, ast.Name):
                    delegate_to = cal.func.id

            func_info[node.name] = {
                "guards": guards,
                "has_req": has_req,
                "delegate": delegate_to,
                "line": node.lineno,
            }

            # Gather route decorators
            for dec in node.decorator_list:
                info = _is_app_route_decorator(dec)
                if info:
                    rule, methods = info
                    route_bindings.append((node.name, node.lineno, rule, methods or ["GET"]))

    # Propagate guards through simple aliases
    eff_guards: Dict[str, List[str]] = {name: info["guards"][:] for name, info in func_info.items()}
    eff_has_req: Dict[str, bool] = {name: bool(info["has_req"]) for name, info in func_info.items()}

    changed = True
    # Limit iterations to avoid cycles
    for _ in range(10):
        if not changed:
            break
        changed = False
        for name, info in func_info.items():
            if eff_guards.get(name):
                continue  # already has guards
            delegate = info.get("delegate")
            if delegate and delegate in eff_guards:
                src_g = eff_guards.get(delegate, [])
                src_has = eff_has_req.get(delegate, False)
                if src_g and not eff_guards.get(name):
                    eff_guards[name] = src_g[:]
                    eff_has_req[name] = src_has
                    changed = True

    # Build RouteDef with effective guards
    routes: List[RouteDef] = []
    for func_name, line_no, rule, methods in route_bindings:
        info = func_info.get(func_name, {"guards": [], "has_req": False})
        routes.append(
            RouteDef(
                file=os.path.relpath(py_path, REPO_ROOT),
                line=line_no,
                function=func_name,
                rule=rule,
                methods=methods,
                guards=info.get("guards", []),
                has_require_auth=bool(info.get("has_req", False)),
                effective_guards=eff_guards.get(func_name, info.get("guards", [])),
                effective_has_require_auth=bool(
                    eff_has_req.get(func_name, info.get("has_req", False))
                ),
            )
        )

    return routes


def scan_backend() -> List[RouteDef]:
    out: List[RouteDef] = []
    for root, _, files in os.walk(BACKEND_DIR):
        for fn in files:
            if not fn.endswith(".py"):
                continue
            path = os.path.join(root, fn)
            # Skip virtualenv/vendor directories if present
            rel = os.path.relpath(path, REPO_ROOT)
            if any(
                part in rel
                for part in ("site-packages", ".venv", "venv", "node_modules", "dist-info")
            ):
                continue
            out.extend(scan_file(path))
    # Normalize and sort by rule then method then file:line
    out.sort(key=lambda r: (r.rule, ",".join(r.methods), r.file, r.line))
    return out


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def write_artifacts(routes: List[RouteDef]) -> Dict[str, str]:
    ensure_dir(ARTIFACTS_DIR)
    json_path = os.path.join(ARTIFACTS_DIR, "flask_guard_scan.json")
    csv_path = os.path.join(ARTIFACTS_DIR, "endpoint_auth_matrix.csv")

    # JSON
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump([asdict(r) for r in routes], jf, indent=2)

    # CSV
    with open(csv_path, "w", newline="", encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow(
            [
                "rule",
                "methods",
                "direct_guards",
                "direct_has_require_auth",
                "effective_guards",
                "effective_has_require_auth",
                "function",
                "file",
                "line",
            ]
        )
        for r in routes:
            writer.writerow(
                [
                    r.rule,
                    ";".join(r.methods),
                    ";".join(r.guards) if r.guards else "",
                    "yes" if r.has_require_auth else "no",
                    ";".join(r.effective_guards) if r.effective_guards else "",
                    "yes" if r.effective_has_require_auth else "no",
                    r.function,
                    r.file,
                    r.line,
                ]
            )

    return {"json": json_path, "csv": csv_path}


def main(argv: List[str]) -> int:
    routes = scan_backend()
    artifacts = write_artifacts(routes)
    print(f"Scanned {len(routes)} routes. Artifacts written:")
    for k, p in artifacts.items():
        print(f" - {k}: {os.path.relpath(p, REPO_ROOT)}")
    # Quick summary counts
    total = len(routes)
    guarded_direct = sum(
        1
        for r in routes
        if r.has_require_auth or any(g.startswith("vehicle_ownership_required") for g in r.guards)
    )
    guarded_effective = sum(
        1
        for r in routes
        if r.effective_has_require_auth
        or any(g.startswith("vehicle_ownership_required") for g in r.effective_guards)
    )
    print(f"Guard coverage (direct): {guarded_direct}/{total}")
    print(f"Guard coverage (effective incl. aliases): {guarded_effective}/{total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
