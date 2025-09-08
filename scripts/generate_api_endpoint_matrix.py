import ast
import csv
import re
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    artifacts_dir = root / "audit_artifacts"
    routes_file = artifacts_dir / "api_routes.txt"
    strings_file = artifacts_dir / "api_strings.txt"
    frontend_calls_file = artifacts_dir / "frontend_api_calls.txt"

    # Collect frontend endpoints for consumer inference
    frontend_paths = set()
    if frontend_calls_file.exists():
        for line in frontend_calls_file.read_text(errors="ignore").splitlines():
            m = re.search(r"(/api/[\w\-./:<>]+)", line)
            if m:
                p = m.group(1)
                if p != "/" and p.endswith("/"):
                    p = p[:-1]
                frontend_paths.add(p)

    endpoints: dict[str, dict] = {}

    def get_item(path: str):
        key = path if path == "/" else path.rstrip("/")
        return endpoints.setdefault(
            key,
            {
                "path": key,
                "methods": set(),
                "files": set(),
                "envelope": "No",
                "pagination": "No",
                "idempotency": "No",
                "consumer": "Internal",
            },
        )

    # Regexes
    route_line_re = re.compile(r"^([^:]+):(\d+):(.+)$")
    dec_route_re = re.compile(r"@[^\n]*?route\(\s*(['\"])(.*?)\1(.*)\)")
    methods_full_re = re.compile(r"methods\s*=\s*(\[[^\]]+\])")
    string_path_re = re.compile(r"(/api/[\w\-./:<>]+)")

    # Heuristics
    json_env_re = re.compile(r"jsonify\s*\(.*success.*data.*\)", re.S)
    json_any_re = re.compile(r"jsonify\s*\(")
    return_env_re = re.compile(r"return\s+\{[^\}]*success[^\}]*data[^\}]*\}")
    page_args_re = re.compile(r"request\.args\.get\(\s*(['\"])(page|limit|offset|per_page)\1")
    paginate_call_re = re.compile(r"\.paginate\(")
    idempotency_re = re.compile(r"Idempotency-Key|X-Idempotency-Key", re.I)

    def analyze_window(file_path: Path, line_no: int, before: int = 20, after: int = 120):
        try:
            lines = file_path.read_text(errors="ignore").splitlines()
        except Exception:
            return ("No", "No", "No")
        i = max(0, line_no - 1)
        win = "\n".join(lines[max(0, i - before) : min(len(lines), i + after)])
        env = "No"
        if json_env_re.search(win) or return_env_re.search(win):
            env = "Yes"
        elif json_any_re.search(win):
            env = "Partial"
        pag = "Yes" if (page_args_re.search(win) or paginate_call_re.search(win)) else "No"
        idem = "Yes" if idempotency_re.search(win) else "No"
        return (env, pag, idem)

    # Parse api_routes.txt
    if routes_file.exists():
        for line in routes_file.read_text(errors="ignore").splitlines():
            m = route_line_re.match(line)
            if not m:
                continue
            file_rel = m.group(1)
            line_no = int(m.group(2))
            payload = m.group(3)
            d = dec_route_re.search(payload)
            path = None
            methods = []
            if d:
                path = d.group(2)
                rest = d.group(3)
                mm = methods_full_re.search(rest)
                if mm:
                    try:
                        parsed = ast.literal_eval(mm.group(1))
                        if isinstance(parsed, (list, tuple)):
                            methods = [str(x).upper() for x in parsed]
                    except Exception:
                        pass
            else:
                sp = string_path_re.search(payload)
                if sp:
                    path = sp.group(1)
            if not path:
                continue
            it = get_item(path)
            it["files"].add(file_rel)
            for me in methods:
                if isinstance(me, str) and me:
                    it["methods"].add(me)
            env, pag, idem = analyze_window(root / file_rel, line_no)
            # Strongest signal wins: Yes > Partial > No
            if env == "Yes" or (env == "Partial" and it["envelope"] == "No"):
                it["envelope"] = env
            if pag == "Yes":
                it["pagination"] = "Yes"
            if idem == "Yes":
                it["idempotency"] = "Yes"

    # Parse api_strings.txt to capture any additional paths and heuristics
    if strings_file.exists():
        for line in strings_file.read_text(errors="ignore").splitlines():
            m = route_line_re.match(line)
            file_rel = None
            line_no = None
            payload = line
            if m:
                file_rel = m.group(1)
                line_no = int(m.group(2))
                payload = m.group(3)
            sp = string_path_re.search(payload)
            if not sp:
                continue
            p = sp.group(1)
            it = get_item(p)
            if file_rel:
                it["files"].add(file_rel)
                env, pag, idem = analyze_window(root / file_rel, line_no or 1)
                if env == "Yes" or (env == "Partial" and it["envelope"] == "No"):
                    it["envelope"] = env
                if pag == "Yes":
                    it["pagination"] = "Yes"
                if idem == "Yes":
                    it["idempotency"] = "Yes"

    # Defaults for methods
    for it in endpoints.values():
        if not it["methods"]:
            it["methods"].add("GET")

    # Consumer inference
    for path, it in endpoints.items():
        if any(path.startswith(fp) or fp.startswith(path) for fp in frontend_paths):
            it["consumer"] = "Frontend"
        if re.search(r"(webhook|hooks|callback)", path):
            it["consumer"] = "Webhook"

    # Write CSV
    csv_path = artifacts_dir / "api_endpoint_matrix.csv"
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "Endpoint Path",
                "Method(s)",
                "Response Envelope Used?",
                "Pagination?",
                "Idempotency Required?",
                "Primary Consumer",
            ]
        )
        for key in sorted(endpoints.keys()):
            it = endpoints[key]
            w.writerow(
                [
                    key,
                    "|".join(sorted(it["methods"])),
                    it["envelope"],
                    it["pagination"],
                    it["idempotency"],
                    it["consumer"],
                ]
            )

    print(f"Wrote {csv_path} with {len(endpoints)} endpoints")


if __name__ == "__main__":
    main()
