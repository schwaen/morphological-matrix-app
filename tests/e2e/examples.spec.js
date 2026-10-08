import { test, expect, menu, tabMenu } from './fixtures.js';

const openKaffee = page =>
  page.locator('#exampleList .doc', { hasText: 'Kaffeemaschine' }).getByRole('button', { name: 'Öffnen' }).click();

test('Erster Start zeigt das erste mitgelieferte Beispiel', async ({ page }) => {
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
  await expect(page.locator('#stats')).toContainText('6 Parameter');
});

test('Datei → Beispiele listet die Beispiele und öffnet sie in einem neuen Tab', async ({ page }) => {
  await menu(page, 'example');
  const dialog = page.locator('#examplesDialog');
  await expect(dialog).toBeVisible();
  const item = page.locator('#exampleList .doc', { hasText: 'Kaffeemaschine' });
  await expect(item).toContainText('6 Parameter · 2 Kategorien · 3 Konzepte');
  await openKaffee(page);
  await expect(dialog).toBeHidden();
  await expect(page.locator('.app-tab')).toHaveCount(2);
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
  await expect(page.locator('#toast')).toContainText('Beispiel „Kaffeemaschine“');
});

test('Menü „+“ öffnet die Beispielauswahl; jedes Öffnen ergibt eine eigene Matrix', async ({ page }) => {
  await tabMenu(page, 'Beispiel öffnen');
  await openKaffee(page);
  await page.locator('#title').dblclick();
  await page.locator('#title').fill('Meine Variante');
  await page.locator('#title').press('Enter');

  await tabMenu(page, 'Beispiel öffnen');
  await openKaffee(page);
  await expect(page.locator('.app-tab')).toHaveCount(3);
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
  await expect(page.locator('.app-tab', { hasText: 'Meine Variante' })).toHaveCount(1);
});

test('Beispielauswahl schließt mit Escape bzw. Klick auf ×', async ({ page }) => {
  await menu(page, 'example');
  await page.keyboard.press('Escape');
  await expect(page.locator('#examplesDialog')).toBeHidden();
  await menu(page, 'example');
  await page.click('#examplesClose');
  await expect(page.locator('#examplesDialog')).toBeHidden();
  await expect(page.locator('.app-tab')).toHaveCount(1);
});

test('Beispiel „Skill-Matrix“: Skills als Parameter, Personen als Konzepte, Nutzwert aktiv', async ({ page }) => {
  await menu(page, 'example');
  await page.locator('#exampleList .doc', { hasText: 'Skill-Matrix' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.locator('#title')).toHaveValue('Beispiel: Skill-Matrix Frontend-Team');
  await expect(page.locator('#stats')).toContainText('16 Parameter');
  await expect(page.locator('#catNav')).toContainText('Softskills');
  const names = await page.locator('#conceptList .concept-name').evaluateAll(els => els.map(el => el.value));
  expect(names).toEqual(['Anna (Senior)', 'Ben (UI-Fokus)', 'Clara (Junior)']);
  await expect(page.locator('#compareTable')).toContainText('Nutzwert');
});

test('Beispiel „Lastenrad“: große Matrix bleibt bedienbar und lesbar', async ({ page }) => {
  await menu(page, 'example');
  await page.locator('#exampleList .doc', { hasText: 'Lastenrad' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.locator('#stats')).toContainText('30 Parameter');
  // Kombinationszahl jenseits von Number.MAX_SAFE_INTEGER: gerundet in Worten, exakt im Tooltip
  const combos = page.locator('.stat', { hasText: 'Kombinationen' });
  await expect(combos).toContainText('≈ 118,9 Billiarden');
  await expect(combos).toHaveAttribute('title', 'Genau: 118.881.339.310.080.000');
  const fits = await combos.evaluate(el => el.querySelector('strong').scrollWidth <= el.clientWidth);
  expect(fits).toBe(true);

  // Ein sehr langer Ausprägungstext zieht die Spalten nicht auf
  const widths = async () => page.locator('.opt-cell').evaluateAll(els => Math.max(...els.map(el => el.offsetWidth)));
  expect(await widths()).toBeLessThan(320);
  await page.click('[data-mode=edit]');
  expect(await widths()).toBeLessThan(320);
});

test('Beispiel „Firmen-Event“: Kosten und Nutzwert (Skala 0–5) im Konzeptvergleich', async ({ page }) => {
  await menu(page, 'example');
  await page.locator('#exampleList .doc', { hasText: 'Firmen-Event' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.locator('#title')).toHaveValue('Beispiel: Firmen-Event planen');
  // Unter einer Billion bleibt die Kombinationszahl exakt
  await expect(page.locator('#stats')).toContainText('17.915.904.000');
  await expect(page.locator('#compareTable')).toContainText('Gesamtkosten');
  await expect(page.locator('#compareTable')).toContainText('Nutzwert (max. 5)');
  await expect(page.locator('#conceptList .concept-name')).toHaveCount(5);
});

test('Food-Truck und Krimi: Konflikte und Hinweise sind sichtbar', async ({ page }) => {
  await menu(page, 'example');
  await page.locator('#exampleList .doc', { hasText: 'Food-Truck gründen' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.locator('#title')).toHaveValue('Beispiel: Food-Truck gründen');
  await expect(page.locator('.concept[data-cid=c5] .cons-pill')).toHaveText('⚠ 4');
  await expect(page.locator('.concept .cons-pill')).toHaveCount(1);

  await menu(page, 'example');
  await page.locator('#exampleList .doc', { hasText: 'Krimi plotten' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.locator('#title')).toHaveValue('Beispiel: Krimi plotten');
  await expect(page.locator('#stats')).toContainText('11 Parameter');
  await expect(page.locator('.concept .cons-pill')).toHaveCount(0);
});
