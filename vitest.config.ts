import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@lib': resolve(__dirname, 'src/renderer/lib'),
      '@store': resolve(__dirname, 'src/renderer/store'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    // Rooted at the project root, so `test:unit` / `test:integration` must
    // narrow with --exclude or a path filter rather than `--dir` — `--dir`
    // re-roots this glob and it then matches nothing at all, silently.
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
