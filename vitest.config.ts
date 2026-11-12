import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const alias = { '@/*': path.resolve(__dirname, './*') };

// Two projects so that only tests which render React / touch the DOM pay for a
// jsdom environment (the dominant cost of a full run). Pure-logic tests run in
// plain node. A node-project test that genuinely needs a DOM opts in with a
// `// @vitest-environment jsdom` docblock instead of moving projects.
const UI_GLOBS = [
  'app/components/**/*.test.{ts,tsx}',
  'app/features/**/*.test.{ts,tsx}',
  'app/hooks/**/*.test.{ts,tsx}',
];

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    // CI runners (2 vCPU) and busy dev boxes were timing out 5 s tests under
    // load; the timeouts only bound a hung test, they do not slow passing ones.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Bounded fan-out: jsdom workers are memory-heavy and oversubscribing the
    // CPU is what made timing-sensitive tests flake.
    maxWorkers: process.env.CI ? 2 : 4,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['app/**/*.{ts,tsx}'],
      exclude: ['app/**/*.test.{ts,tsx}', 'app/**/__tests__/**'],
      thresholds: {
        'app/lib/**': { lines: 90 },
        'app/renderer/**': { lines: 70 },
        'app/hooks/useBreathTimer.ts': { lines: 95 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-node',
          environment: 'node',
          include: ['app/**/*.test.{ts,tsx}'],
          exclude: UI_GLOBS,
        },
      },
      {
        extends: true,
        test: {
          name: 'ui-jsdom',
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: UI_GLOBS,
        },
      },
    ],
  },
});
