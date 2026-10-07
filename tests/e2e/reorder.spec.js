import { test, expect } from './fixtures.js';

const firstRow = page => page.locator('.opt-cell.edit .opt-main textarea')
  .evaluateAll(els => els.slice(0, 4).map(e => e.value));

test('Ausprägungen per Leiste und Alt+Pfeil verschieben', async ({ page }) => {
  await page.click('[data-mode=edit]');
  const first = page.locator('.opt-cell.edit').first();
  await first.hover();
  await expect(first.locator('.opt-tools')).toHaveCSS('opacity', '1');
  await expect(first.getByRole('button', { name: /Nach links/ })).toBeDisabled();
  await first.getByRole('button', { name: /Nach rechts/ }).click();
  expect(await firstRow(page)).toEqual(['Boiler', 'Durchlauferhitzer', 'Thermoblock', 'Induktion']);

  await page.getByLabel('Wassererwärmung: Ausprägung 2').focus();
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Alt+ArrowRight');
  expect(await firstRow(page)).toEqual(['Boiler', 'Thermoblock', 'Induktion', 'Durchlauferhitzer']);
  await expect(page.locator(':focus')).toHaveValue('Durchlauferhitzer');

  await page.click('#undoBtn');
  expect(await firstRow(page)).toEqual(['Boiler', 'Thermoblock', 'Durchlauferhitzer', 'Induktion']);
});

test('Verschieben erhält die Auswahl der Konzepte', async ({ page }) => {
  await page.click('[data-mode=edit]');
  const first = page.locator('.opt-cell.edit').first();
  await first.hover();
  await first.getByRole('button', { name: /Nach rechts/ }).click();
  await page.click('[data-mode=select]');
  await expect(page.locator('.opt-cell.pick.is-active').first()).toContainText('Thermoblock');
});

test('Touch-Geräte: Werkzeuge immer sichtbar', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const { APP_URL } = await import('./fixtures.js');
  await page.goto(APP_URL);
  await page.click('[data-mode=edit]');
  await expect(page.locator('.opt-tools').first()).toHaveCSS('opacity', '1');
  // Auch die Konzept-Aktionen (ohne Maus kein Darüberfahren)
  const inactive = page.locator('.concept:not(.is-active) .concept-tools').first();
  await expect(inactive).toHaveCSS('opacity', '1');
  await expect(inactive).toHaveCSS('position', 'static');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
});
