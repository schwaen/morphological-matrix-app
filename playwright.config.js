import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    acceptDownloads: true,
    // Die meisten Tests prüfen deutsche Texte; englische Tests stellen die Sprache selbst um.
    locale: 'de-DE',
  },
  // Getestet wird der Build (npm run build), so wie er auf GitHub Pages läuft
  webServer: {
    command: 'npx vite preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
