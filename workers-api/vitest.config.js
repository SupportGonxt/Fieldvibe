import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// pool-workers 0.13 (vitest v4): defineWorkersConfig / ./config export removed.
// Workers pool is now a plugin (cloudflareTest); poolOptions.workers -> plugin arg.
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.toml' } })],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'src/index.js', // Main entry point
        'src/**/*.test.js', // Test files
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
});
