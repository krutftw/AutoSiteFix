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
    deps: {
      optimizer: {
        ssr: {
          include: ['@babel/parser', '@babel/traverse', '@babel/generator', '@babel/types']
        }
      }
    },
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
