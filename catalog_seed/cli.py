"""Console script entry point for catalog-seed."""

from .generate_seed_v2 import main as _main  # noqa: F401


def main() -> None:
    _main()
