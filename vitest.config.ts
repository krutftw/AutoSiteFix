import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const resolvePackage = (pkg: string) =>
  path.resolve(rootDir, 'packages', pkg, 'src', 'index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@autositefix/auditor': resolvePackage('auditor'),
      '@autositefix/report': resolvePackage('report'),
      '@autositefix/git': resolvePackage('git'),
      '@autositefix/fixer': resolvePackage('fixer')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov'],
      provider: 'v8'
    }
  }
});
