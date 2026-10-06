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
  await expect(page.locator('#exampleList .doc')).toHaveCount(2);
  await page.locator('#exampleList .doc', { hasText: 'Skill-Matrix' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.locator('#title')).toHaveValue('Beispiel: Skill-Matrix Frontend-Team');
  await expect(page.locator('#stats')).toContainText('16 Parameter');
  await expect(page.locator('#catNav')).toContainText('Softskills');
  const names = await page.locator('#conceptList input[type=text]').evaluateAll(els => els.map(el => el.value));
  expect(names).toEqual(['Anna (Senior)', 'Ben (UI-Fokus)', 'Clara (Junior)']);
  await expect(page.locator('#compareTable')).toContainText('Nutzwert');
});
