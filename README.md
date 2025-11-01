# AutoSiteFix

[![CI](https://github.com/krutftw/AutoSiteFix/actions/workflows/ci.yml/badge.svg)](https://github.com/krutftw/AutoSiteFix/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

AutoSiteFix is an open-source Node.js CLI that audits, fixes, and documents web performance, accessibility, and SEO improvements. It combines Lighthouse, axe-core, and AST-based code transforms to deliver production-ready pull requests with clear reporting.

## Features

- 🔦 Programmatic multi-page Lighthouse and axe-core audits with sitemap-style crawling
- 🛠️ Safe, idempotent AST-based fixes for HTML, JSX/TSX, and blocking scripts
- 📝 Beautiful HTML reports and structured JSON summaries saved to `autositefix-report/`
- 🌳 Git-aware workflow that can stage commits and open pull requests with score summaries
- 🧩 Modular TypeScript workspace spanning CLI, auditing, fixing, reporting, and git automation packages
- 🪄 WordPress micro-plugin generator for sites that prefer theme-agnostic injections

## Monorepo layout

```
packages/
  ai/        # Future AI-assisted recommendations (stub)
  auditor/   # Lighthouse + axe-core integration utilities
  cli/       # autositefix command-line entrypoint
  fixer/     # AST-based code transforms and WordPress mode
  git/       # Git/GitHub helpers for branches and PRs
  report/    # Report generation utilities
```

## Getting started

### Prerequisites

- Node.js 18.17+
- npm 9+ (or any workspace-aware package manager)

### Install

```bash
npm install
```

### Build the workspace

```bash
npm run build
```

### Run tests

```bash
npm test
```

## Quick start

Run an audit and preview safe fixes with:

```bash
npx autositefix --url https://example.com --pages 5 --fix perf,a11y,seo --dry-run
```

The command crawls up to five internal pages, runs Lighthouse + axe-core, writes
`autositefix-report/index.html`, and lists the fixes that would be applied. Remove
`--dry-run` to write changes locally and optionally open a pull request.

## CLI options

| Flag | Description | Default |
| ---- | ----------- | ------- |
| `--url <string>` | Entry URL to audit | _required_ |
| `--pages <number>` | Maximum number of pages to crawl | `5` |
| `--fix <list>` | Comma-separated fix categories (perf, a11y, seo) | none |
| `--dry-run` | Audit without writing changes or opening PRs | `false` |
| `--provider <name>` | Optional provider for AI-assisted rationale | `local` |
| `--wordpress` | Generate WordPress micro-plugin instead of direct edits | `false` |

## Development scripts

| Command | Description |
| ------- | ----------- |
| `npm run lint` | Run ESLint across the workspace |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Verify formatting without modifying files |
| `npm run typecheck` | Type-check all packages via project references |
| `npm test` | Execute Vitest test suite |

## Roadmap

- [x] Implement Lighthouse + axe-core auditor
- [x] Wire CLI to auditing pipeline and reporting
- [x] Add AST-based fixers for HTML, JSX/TSX, and scripts
- [x] Automate git flow with branch, commit, and PR helpers
- [x] Generate rich HTML reports and JSON summaries
- [x] Add WordPress mode micro-plugin output
- [ ] Integrate optional AI rationale via `packages/ai`

## Optional: Codex CLI

Prefer working with the Codex CLI?

```bash
npm install -g @openai/codex
codex login
codex run autositefix --url https://example.com --dry-run
```

## Contributing

Contributions are welcome! Please open an issue or pull request to discuss your ideas. See the roadmap above for upcoming milestones.

## License

AutoSiteFix is released under the [MIT License](./LICENSE).
