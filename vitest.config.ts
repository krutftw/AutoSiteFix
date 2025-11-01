import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const packagesDir = fileURLToPath(new URL('./packages', import.meta.url)).replace(/\/g, '/');

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
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      provider: 'v8'
    }
  }
});
