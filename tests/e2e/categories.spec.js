import { test, expect, downloadText } from './fixtures.js';

const bands = page => page.locator('.cat-band');
const paramCells = page => page.locator('.param-cell');

test('Kategorien erscheinen als Bänder mit Fortschritt und Chips', async ({ page }) => {
  await expect(bands(page)).toHaveCount(2);
  await expect(bands(page).first()).toContainText('Brühsystem');
  await expect(bands(page).first()).toContainText('3/3 gewählt');
  await expect(page.locator('.cat-chip')).toHaveText([/Brühsystem\s*3\/3/, /Nutzung & Betrieb\s*3\/3/]);
});

test('Einklappen zeigt die Auswahl, unterbricht Linien und bleibt nach Neuladen', async ({ page }) => {
  const segments = () => page.evaluate(() => [...document.querySelectorAll('#lines path')]
    .map(p => (p.getAttribute('d').match(/M/g) || []).length));
  expect(await segments()).toEqual([5, 5, 5]);

  await bands(page).first().locator('.cat-toggle').click();
  await expect(paramCells(page)).toHaveCount(3);
  await expect(bands(page).first().locator('.cat-picks')).toContainText('Thermoblock');
  await expect.poll(segments).toEqual([2, 2, 2]);

  await page.reload();
  await expect(paramCells(page)).toHaveCount(3);
});

test('Alle ein-/ausklappen und Sprung über Chips', async ({ page }) => {
  await page.getByRole('button', { name: 'Alle einklappen' }).click();
  await expect(paramCells(page)).toHaveCount(0);
  await page.locator('.cat-chip').nth(1).click();
  await expect(paramCells(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Alle ausklappen' }).click();
  await expect(paramCells(page)).toHaveCount(6);
});

test('Bearbeiten: zuordnen, neue Kategorie, löschen und Rückgängig', async ({ page }) => {
  page.on('dialog', d => d.accept('Neue Kat'));
  await page.click('[data-mode=edit]');
  const names = () => page.locator('.param-name').evaluateAll(els => els.map(e => e.value));

  // „Reinigung“ in die erste Kategorie verschieben → Reihenfolge folgt der Kategorie
  await page.getByLabel('Kategorie von Reinigung').selectOption({ label: 'Brühsystem' });
  expect(await names()).toEqual(['Wassererwärmung', 'Druckerzeugung', 'Kaffeezufuhr', 'Reinigung', 'Bedienung', 'Energieversorgung']);

  await page.getByLabel('Kategorie von Wassererwärmung').selectOption('__new');
  await expect(page.locator('.cat-name')).toHaveCount(3);
  await expect(page.locator('.cat-name').nth(2)).toHaveValue('Neue Kat');

  await bands(page).first().getByRole('button', { name: /Kategorie löschen/ }).click();
  await expect(bands(page).last()).toContainText('Ohne Kategorie');

  for (let i = 0; i < 3; i++) await page.click('#undoBtn');
  expect(await names()).toEqual(['Wassererwärmung', 'Druckerzeugung', 'Kaffeezufuhr', 'Bedienung', 'Energieversorgung', 'Reinigung']);
});

test('„+ Parameter“ im Band legt den Parameter in dieser Kategorie an', async ({ page }) => {
  await page.click('[data-mode=edit]');
  await page.click('#addCategoryBtn');
  await expect(page.locator(':focus')).toHaveClass(/cat-name/);
  await bands(page).nth(2).getByRole('button', { name: 'Parameter', exact: true }).click();
  await expect(paramCells(page)).toHaveCount(7);
  await expect(bands(page).nth(2)).toContainText('1 Parameter');
});

test('Parameter lassen sich nur innerhalb der Kategorie verschieben', async ({ page }) => {
  await page.click('[data-mode=edit]');
  const cell = paramCells(page).nth(2); // Kaffeezufuhr – letzter in „Brühsystem“
  await expect(cell.getByRole('button', { name: 'Nach unten verschieben' })).toBeDisabled();
  await cell.hover();
  await cell.getByRole('button', { name: 'Nach oben verschieben' }).click();
  await expect(page.locator('.param-name').nth(1)).toHaveValue('Kaffeezufuhr');
});

test('Vergleich und CSV sind nach Kategorien gegliedert; Druck klappt alles aus', async ({ page }) => {
  await expect(page.locator('#compareTable tr.cat-row')).toHaveCount(2);
  const { text } = await downloadText(page, 'export-csv');
  expect(text).toContain('"Nutzung & Betrieb";"Bedienung"');

  await page.getByRole('button', { name: 'Alle einklappen' }).click();
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await expect(paramCells(page)).toHaveCount(6);
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  await expect(paramCells(page)).toHaveCount(0);
});
