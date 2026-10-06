import { test, expect, menu, setTitle, APP_URL } from './fixtures.js';

test('Zwei Tabs bearbeiten unabhängig verschiedene Matrizen', async ({ page, context }) => {
  const b = await context.newPage();
  await b.goto(APP_URL);
  // Neuer Tab öffnet zunächst die zuletzt bearbeitete Matrix
  await expect(b.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');

  await menu(b, 'new');
  await setTitle(b, 'Matrix B');
  await setTitle(page, 'Matrix A');

  await expect(page.locator('#title')).toHaveValue('Matrix A');
  await expect(b.locator('#title')).toHaveValue('Matrix B');
  await page.reload();
  await b.reload();
  await expect(page.locator('#title')).toHaveValue('Matrix A');
  await expect(b.locator('#title')).toHaveValue('Matrix B');
});

test('Dieselbe Matrix in zwei Tabs wird abgeglichen', async ({ page, context }) => {
  const b = await context.newPage();
  await b.goto(APP_URL);
  await setTitle(page, 'Synchron');
  await expect(b.locator('#title')).toHaveValue('Synchron');
});

test('Ansichtseinstellungen gelten pro Tab', async ({ page, context }) => {
  const b = await context.newPage();
  await b.goto(APP_URL);
  await page.locator('#compareToggle').click();
  await page.click('[data-mode=edit]');
  await b.reload();
  await expect(b.locator('#compareToggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(b.locator('[data-mode=select]')).toHaveAttribute('aria-pressed', 'true');
});
