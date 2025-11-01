"""Command line interface for AutoSiteFix."""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Optional

from .wordpress import generate_wordpress_plugin


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="AutoSiteFix command line interface",
    )
    parser.add_argument(
        "--wordpress",
        action="store_true",
        help="Generate WordPress fixes plugin stub (wp-content/plugins/autositefix-fixes).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path.cwd(),
        help="Directory where generated files should be written (default: current directory).",
    )
    return parser


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if not args.wordpress:
        parser.error("No mode selected. Pass --wordpress to generate the WordPress fixes plugin stub.")

    plugin_dir = generate_wordpress_plugin(args.output)
    print(f"Generated WordPress fixes plugin stub at {plugin_dir}")
    return 0


if __name__ == "__main__":  # pragma: no cover - manual invocation
    raise SystemExit(main())
