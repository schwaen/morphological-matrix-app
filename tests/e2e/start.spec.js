import { test, expect, tabMenu } from './fixtures.js';

test('Logo öffnet das Start-Menü; Esc schließt es und setzt den Fokus zurück', async ({ page }) => {
  const logo = page.locator('#logoBtn');
  await expect(logo).toHaveAttribute('aria-label', 'Start & Hilfe');
  await logo.click();
  const menu = page.locator('#startMenu');
  await expect(menu).toBeVisible();
  await expect(logo).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('menuitem')).toHaveText(['Neue leere Matrix', 'Beispiel öffnen …', 'Meine Matrizen …', 'Hilfe & Tastenkürzel', 'Über die App']);
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(logo).toBeFocused();
  await expect(logo).toHaveAttribute('aria-expanded', 'false');
});

test('Start-Menü: Einträge lösen ihre Aktion aus, zuletzt bearbeitete Matrix öffnet sich', async ({ page }) => {
  await page.click('#logoBtn');
  await page.locator('#startMenu').getByRole('menuitem', { name: 'Neue leere Matrix' }).click();
  await expect(page.locator('#title')).toHaveValue('Neue morphologische Matrix');
  await expect(page.locator('#startMenu')).toBeHidden();

  // Die Kaffeemaschine erscheint unter „Zuletzt bearbeitet“ und lässt sich von dort öffnen
  await page.click('#logoBtn');
  const recent = page.locator('#startMenu').getByRole('menuitem', { name: /Beispiel: Kaffeemaschine/ });
  await expect(recent).toBeVisible();
  await recent.click();
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
  await expect(page.locator('.app-tab')).toHaveCount(2); // bereits geöffnet: kein zweiter Tab

  await page.click('#logoBtn');
  await page.locator('#startMenu').getByRole('menuitem', { name: 'Meine Matrizen …' }).click();
  await expect(page.locator('#libraryDialog')).toBeVisible();
});

test('Hilfe & Über: Reiter per Klick und Pfeiltasten, Über direkt aus dem Menü', async ({ page }) => {
  await page.click('#logoBtn');
  await page.locator('#startMenu').getByRole('menuitem', { name: 'Hilfe & Tastenkürzel' }).click();
  const dlg = page.locator('#helpDialog');
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('tab', { name: 'Erste Schritte' })).toHaveAttribute('aria-selected', 'true');
  await expect(dlg.locator('#helpStart li')).toHaveCount(3);

  await page.keyboard.press('ArrowRight');
  await expect(dlg.getByRole('tab', { name: 'Tastenkürzel' })).toHaveAttribute('aria-selected', 'true');
  await expect(dlg.locator('#helpKeys')).toBeVisible();
  await expect(dlg.locator('#helpKeys')).toContainText('Strg+S');
  await expect(dlg.locator('#helpStart')).toBeHidden();
  await page.click('#helpDone');
  await expect(dlg).toBeHidden();

  await page.click('#logoBtn');
  await page.locator('#startMenu').getByRole('menuitem', { name: 'Über die App' }).click();
  await expect(dlg.getByRole('tab', { name: 'Über' })).toHaveAttribute('aria-selected', 'true');
  await expect(dlg.locator('#helpAbout')).toContainText('nur lokal in diesem Browser gespeichert');
  await expect(page.locator('#helpMeta')).toHaveText('Datenformat 7 · Daten nur lokal in diesem Browser');
});

test('Start-Menü bleibt im schmalen Fenster sichtbar und schließt beim Klick daneben', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.click('#logoBtn');
  const box = await page.locator('#startMenu').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.locator('#description').click();
  await expect(page.locator('#startMenu')).toBeHidden();
  // Das „+“-Menü der Tabs funktioniert weiterhin unabhängig davon
  await tabMenu(page, 'Neue leere Matrix');
  await expect(page.locator('.app-tab')).toHaveCount(2);
});
