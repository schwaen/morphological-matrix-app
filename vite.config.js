import { defineConfig } from 'vite';

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
});
