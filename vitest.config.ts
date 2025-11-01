import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const packagesDir = fileURLToPath(new URL('./packages', import.meta.url)).replace(/\/g, '/');

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@autositefix\/(.*)$/,
        replacement: `${packagesDir}/$1/src`
      }
    ]
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
