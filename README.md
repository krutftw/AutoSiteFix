# AutoSiteFix

[![CI](https://github.com/krutftw/AutoSiteFix/actions/workflows/ci.yml/badge.svg)](https://github.com/krutftw/AutoSiteFix/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Project overview

AutoSiteFix is a Node.js CLI that audits websites, applies safe code fixes, and produces documentation quality reports. It orchestrates Lighthouse and axe-core scans across multiple pages, applies AST-driven code transforms, and can open pull requests that describe every improvement. Reports are written to disk so you can review performance, accessibility, and SEO changes before shipping them.

### Key capabilities

- Crawl a sitemap-style list of pages starting from a single URL.
- Run Lighthouse and axe-core against each page to produce score deltas.
- Apply idempotent fixes to HTML, JSX/TSX, and script assets.
- Generate HTML and JSON reports in `autositefix-report/`.
- Prepare git branches, commits, and pull requests with audit summaries.

## Installation

### Prerequisites

- Node.js 18.17 or later.
- Git (required for branch automation and pull request creation).

### Steps

```bash
corepack enable
pnpm install
```

`corepack enable` ensures `pnpm` is available even if it is not installed globally. The workspace uses pnpm workspaces, so a single install fetches dependencies for every package in the monorepo.

## Build and test

| Command | Description |
| --- | --- |
| `pnpm build` | Compile all packages using the shared TypeScript project references. |
| `pnpm test` | Run the Vitest suite for the entire workspace. |
| `pnpm lint` | Execute ESLint checks across every package. |
| `pnpm typecheck` | Verify types without emitting build artifacts. |

Run these commands from the repository root. Always make sure `pnpm test` and `pnpm lint` pass before opening a pull request.

## CLI usage

Once dependencies are installed you can run the CLI from the repository root. The following command crawls five pages starting from the home page, applies fixes, and writes reports:

```bash
pnpm autositefix --url https://example.com --pages 5 --fix perf,a11y,seo --dry-run
```

A successful execution prints a summary similar to:

```
✔ Audit complete (5 pages)
✔ Reports written to autositefix-report/index.html
ℹ Dry run: no files were modified. Re-run without --dry-run to apply fixes and open PRs.
```

Each run writes HTML and JSON artifacts beneath `autositefix-report/`. The HTML dashboard includes before/after scores and a detailed list of code changes the CLI would apply.

### GitHub authentication

Pull request automation requires a `GITHUB_TOKEN` with `repo` scope in your environment. Export it before running any command that uses the PR features:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

Without this token the CLI will skip PR creation but still generate local reports and apply fixes.

## Contribution guidelines

- **Branch naming:** create feature branches using `feature/<short-description>` or `fix/<short-description>` (e.g., `feature/report-tweaks`).
- **Testing:** run `pnpm lint` and `pnpm test` locally before pushing changes.
- **Pull requests:** include a summary of the audit/fixes performed and attach relevant report screenshots if the CLI produced them.
- **Reports:** upload the generated `autositefix-report/` artifacts when possible so reviewers can verify improvements.

## Additional resources

- [MIT License](./LICENSE)
- GitHub Actions CI badge above links to the current build status.
