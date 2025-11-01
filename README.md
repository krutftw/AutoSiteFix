# AutoSiteFix

AI-powered website optimizer that audits, fixes, and auto-commits real code improvements for performance, SEO, and accessibility.

## Usage

Install the project in editable mode or run the module directly. The CLI currently supports generating a WordPress plugin stub that AutoSiteFix can populate with fixes in the future.

```bash
python -m autositefix.cli --wordpress --output /path/to/site
```

This command creates the directory `wp-content/plugins/autositefix-fixes/` inside the provided output directory and emits a starter plugin file that hooks into `wp_head` and `the_content`.
