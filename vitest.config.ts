import { createRequire } from 'node:module';

import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
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
