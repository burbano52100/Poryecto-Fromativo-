import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Los tests corren en serie para evitar conflictos de BD
    fileParallelism: false,
    setupFiles: ['./src/tests/setup.ts'],
  },
});
