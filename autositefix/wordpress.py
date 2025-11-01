"""Utilities for generating WordPress integration stubs."""
from __future__ import annotations

from pathlib import Path

PLUGIN_RELATIVE_PATH = Path("wp-content/plugins/autositefix-fixes")
PLUGIN_MAIN_FILE = "autositefix-fixes.php"


PLUGIN_TEMPLATE = """<?php
/**
 * Plugin Name: AutoSiteFix Fixes
 * Description: Auto-generated stub that hooks into wp_head and the_content.
 * Version: 0.1.0
 * Author: AutoSiteFix
 */

if (!defined('ABSPATH')) {
    exit;
}

function autositefix_wp_head_stub() {
    echo "<!-- AutoSiteFix wp_head hook placeholder -->"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
add_action('wp_head', 'autositefix_wp_head_stub');

function autositefix_the_content_stub($content) {
    // TODO: Replace with AutoSiteFix content adjustments.
    return $content;
}
add_filter('the_content', 'autositefix_the_content_stub');
"""


def generate_wordpress_plugin(base_directory: Path) -> Path:
    """Generate the WordPress fixes plugin stub.

    Args:
        base_directory: Base directory where the wp-content tree should be created.

    Returns:
        Path to the generated plugin directory.
    """
    plugin_directory = base_directory / PLUGIN_RELATIVE_PATH
    plugin_directory.mkdir(parents=True, exist_ok=True)

    plugin_file = plugin_directory / PLUGIN_MAIN_FILE
    plugin_file.write_text(PLUGIN_TEMPLATE)

    return plugin_directory
