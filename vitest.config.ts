import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Neutralize the `server-only` marker so server-layer logic (authz, etc.)
      // can be unit-tested under the node environment.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
