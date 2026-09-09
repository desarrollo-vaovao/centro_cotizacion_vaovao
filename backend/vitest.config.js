import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/helpers/globalSetup.js'],
    testTimeout: 15000,
    fileParallelism: false
  }
});
