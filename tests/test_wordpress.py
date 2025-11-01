from __future__ import annotations

import builtins
import sys
from pathlib import Path

import pytest

# Ensure the package is importable when the project is not installed.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from autositefix import cli
from autositefix.wordpress import (
    PLUGIN_MAIN_FILE,
    PLUGIN_RELATIVE_PATH,
    generate_wordpress_plugin,
)


def test_generate_wordpress_plugin_creates_structure(tmp_path: Path) -> None:
    plugin_dir = generate_wordpress_plugin(tmp_path)

    assert plugin_dir == tmp_path / PLUGIN_RELATIVE_PATH
    assert plugin_dir.exists()

    plugin_file = plugin_dir / PLUGIN_MAIN_FILE
    assert plugin_file.exists()

    content = plugin_file.read_text()
    assert "add_action('wp_head'" in content
    assert "add_filter('the_content'" in content


def test_cli_wordpress_option_creates_plugin(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    captured_output: list[str] = []

    def fake_print(message: str) -> None:
        captured_output.append(message)

    monkeypatch.setattr(builtins, "print", fake_print)

    exit_code = cli.main(["--wordpress", "--output", str(tmp_path)])

    assert exit_code == 0
    plugin_dir = tmp_path / PLUGIN_RELATIVE_PATH
    assert plugin_dir.exists()
    assert any(str(plugin_dir) in line for line in captured_output)
