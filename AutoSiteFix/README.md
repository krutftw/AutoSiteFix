# AutoSiteFix

AI-powered website optimizer that audits, fixes, and auto-commits real code improvements for performance, SEO, and accessibility.

## Quick start
```bash
# in a repo you want to audit
npx autositefix --url https://example.com --pages 2 --dry-run
```

> **Status:** Early scaffold. CLI prints arguments; auditor/fixer/PR modules are stubs to be implemented.

## Roadmap (v1)

* Programmatic Lighthouse + axe-core (report to `autositefix-report/`)
* Safe AST transforms (images lazy/decoding, head tags, safe `defer`)
* Branch + PR with rationale and metrics
* WordPress micro-plugin mode
* CI action + Slack/GitHub notifications