import path from 'node:path';
import { defineConfig } from 'vitest/config';

// minimal config: only pure-function unit tests today (no components/hooks
// rendered), so no jsdom environment or React plugin needed — just the same
// "@" alias vite.config.ts uses
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
