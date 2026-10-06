import { test, expect, menu } from './fixtures.js';

test('Beispiel wird geladen und zeigt Kennzahlen', async ({ page }) => {
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
  await expect(page.locator('#stats')).toContainText('6 Parameter');
  await expect(page.locator('#stats')).toContainText('23 Ausprägungen');
  await expect(page.locator('#stats')).toContainText('3.072 mögliche Kombinationen');
  await expect(page.locator('.concept')).toHaveCount(3);
});

test('Ausprägung im Modus „Kombinieren“ an- und abwählen', async ({ page }) => {
  const cell = page.locator('.opt-cell.pick', { hasText: 'Durchlauferhitzer' });
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#conceptSummary')).toContainText('Durchlauferhitzer');
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
});

test('Bearbeiten: Enter legt neue Ausprägung an, Rückgängig/Wiederholen', async ({ page }) => {
  await page.click('[data-mode=edit]');
  await page.locator('.add-opt').first().click();
  await page.keyboard.type('Solar');
  await page.keyboard.press('Enter');
  await expect(page.locator('#stats')).toContainText('25 Ausprägungen');
  await page.click('#undoBtn');
  await expect(page.locator('#stats')).toContainText('24 Ausprägungen');
  await page.click('#redoBtn');
  await expect(page.locator('#stats')).toContainText('25 Ausprägungen');
});

test('Neue leere Matrix startet im Bearbeiten-Modus ohne Kategorien', async ({ page }) => {
  await menu(page, 'new');
  await expect(page.locator('#title')).toHaveValue('Neue morphologische Matrix');
  await expect(page.locator('[data-mode=edit]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cat-band')).toHaveCount(0);
  await expect(page.locator('#catNav')).toBeHidden();
});

test('Konzeptvergleich ist einklappbar und merkt sich den Zustand', async ({ page }) => {
  const toggle = page.locator('#compareToggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#compareTable')).toBeHidden();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('Zusammenfassung zeigt ohne Bewertung keinen Text „null“', async ({ page }) => {
  expect(await page.locator('body').innerText()).not.toMatch(/\bnull\b/);
});

test('Handybreite: kein horizontales Scrollen der Seite', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['select', 'edit']) {
    await page.click(`[data-mode=${mode}]`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});

test('Lange Konzeptnamen brechen um und bleiben vollständig lesbar', async ({ page }) => {
  const name = page.locator('.concept').first().locator('.concept-name');
  const singleLine = await name.evaluate(el => el.offsetHeight);
  await name.fill('Hybrider Jahresauftakt mit Kundinnen und Kunden');
  await name.press('Enter');
  await expect(name).toHaveValue('Hybrider Jahresauftakt mit Kundinnen und Kunden'); // Enter fügt keinen Umbruch ein
  const box = await name.evaluate(el => ({ h: el.offsetHeight, scrollH: el.scrollHeight, clientH: el.clientHeight, scrollW: el.scrollWidth, clientW: el.clientWidth }));
  expect(box.h).toBeGreaterThan(singleLine);
  expect(box.scrollH).toBeLessThanOrEqual(box.clientH + 1);
  expect(box.scrollW).toBeLessThanOrEqual(box.clientW + 1);
  // Nach dem Neuladen bleibt der Name einzeilig gespeichert
  await page.reload();
  await expect(page.locator('.concept-name').first()).toHaveValue('Hybrider Jahresauftakt mit Kundinnen und Kunden');
});

test('Konzept-Aktionen: am aktiven Konzept sichtbar, sonst beim Darüberfahren', async ({ page }) => {
  const opacity = loc => loc.evaluate(el => Number(getComputedStyle(el).opacity));
  const active = page.locator('.concept.is-active .concept-tools');
  const other = page.locator('.concept:not(.is-active)').first();
  expect(await opacity(active)).toBe(1);
  await page.mouse.move(0, 0);
  await expect.poll(() => opacity(other.locator('.concept-tools'))).toBe(0);
  await other.hover();
  await expect.poll(() => opacity(other.locator('.concept-tools'))).toBe(1);
  await other.getByRole('button', { name: 'Konzept duplizieren' }).click();
  await expect(page.locator('.concept')).toHaveCount(4);
});
