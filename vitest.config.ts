import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { sep, posix } from 'node:path';

const toPosixPath = (value: string) => value.split(sep).join(posix.sep);
const packagesDir = toPosixPath(fileURLToPath(new URL('./packages', import.meta.url)));

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const resolvePackage = (pkg: string) =>
  path.resolve(rootDir, 'packages', pkg, 'src', 'index.ts');

const require = createRequire(import.meta.url);

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
  },
  resolve: {
    alias: {
      '@babel/parser': require.resolve('@babel/parser'),
      '@babel/traverse': require.resolve('@babel/traverse'),
      '@babel/generator': require.resolve('@babel/generator'),
      '@babel/types': require.resolve('@babel/types')
    }
  }
});
