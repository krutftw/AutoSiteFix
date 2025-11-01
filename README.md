# AutoSiteFix

AutoSiteFix is an AI-powered website optimizer that audits, fixes, and auto-commits real code
improvements for performance, SEO, and accessibility.

## Repository structure

This repository uses an npm workspace layout to support multiple applications and packages:

- `apps/` – application entry points and runnable services.
- `packages/` – shared libraries and tooling that can be consumed by apps or other packages.

## Tooling

| Tooling            | Purpose                                      |
| ------------------ | -------------------------------------------- |
| TypeScript         | Typed development across all workspaces      |
| ESLint + Prettier  | Consistent linting and formatting            |
| Vitest             | Unit testing framework with Node environment |

## Getting started

Install dependencies and run the quality gates:

```bash
npm install
npm run lint
npm run typecheck
npm test
```

To automatically format the codebase:

```bash
npm run format:write
```

## Continuous integration

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for the automated checks that run on each
pull request.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
