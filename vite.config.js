import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative Pfade: läuft unter https://<user>.github.io/<repo>/ ebenso wie lokal mit `vite preview`
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
  // Unit-Tests der DOM-freien Logik (Browser-Tests: Playwright, tests/e2e/)
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.js'],
    coverage: {
      provider: 'v8',
      // DOM-freie Logik; Speicher (storage.js) und Worker laufen nur im Browser (E2E-Tests),
      // die Sprachdateien enthalten nur Textbausteine
      include: ['js/*.js'],
      exclude: ['js/storage.js', 'js/count-worker.js'],
      reporter: ['text'],
    },
  },
});
