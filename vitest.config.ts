import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/*': path.resolve(__dirname, './*'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/*.test.ts', 'app/**/*.test.tsx'],
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
  },
});
