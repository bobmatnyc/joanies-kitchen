import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    globals: true,
    // #54: Playwright specs (*.spec.ts) are run by `pnpm test:e2e`, not vitest.
    // #54: API integration tests need a live database; they run via vitest.integration.config.ts.
    exclude: [...configDefaults.exclude, '**/*.spec.{ts,tsx}', 'test/tests/integration/**'],
    // #54: placeholder so modules that validate DATABASE_URL at import load without a real secret.
    env: { DATABASE_URL: 'postgresql://ci:ci@localhost:5432/ci' },
    css: true,
    // #54: next-auth imports 'next/server' without extension; inline so vite resolves it.
    server: { deps: { inline: ['next-auth'] } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'out/',
        'dist/',
        '*.config.*',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'scripts/',
        'drizzle/',
      ],
    },
  },
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, './server-only-stub.ts'),
      '@': path.resolve(__dirname, '../../src'),
    },
  },
});
