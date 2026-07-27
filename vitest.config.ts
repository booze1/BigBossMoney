import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Several invariants simulate an hour or more of game time.
    testTimeout: 30_000,
  },
});
