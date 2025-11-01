import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { sep, posix } from 'node:path';

const toPosixPath = (value: string) => value.split(sep).join(posix.sep);
const packagesDir = toPosixPath(fileURLToPath(new URL('./packages', import.meta.url)));

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
