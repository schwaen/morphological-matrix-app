import { test, expect, setEvaluation, compareFooter, downloadText } from './fixtures.js';

test('Ohne Bewertung keine Kennzahlen', async ({ page }) => {
  await expect(page.locator('.opt-metrics-view')).toHaveCount(0);
  await expect(page.locator('#compareTable tfoot')).toHaveCount(0);
  await expect(page.locator('#autoConcepts')).toBeHidden();
});

test('Kosten, Nutzwert und Preis-Leistung werden berechnet', async ({ page }) => {
  await setEvaluation(page, { costs: true });
  expect(await compareFooter(page)).toEqual(['Gesamtkosten 54,00 € 57,00 € 133,00 €']);

  await setEvaluation(page, { utility: true });
  expect(await compareFooter(page)).toEqual([
    'Gesamtkosten 54,00 € 57,00 € 133,00 €',
    'Nutzwert (max. 10) 7,25 5,75 7,58',
    'Preis-Leistung Kosten je Nutzwertpunkt 7,45 € 9,91 € 17,54 €',
  ]);
  await expect(page.locator('.metrics')).toContainText('54,00 €');
  await expect(page.locator('.metrics')).toContainText('7,25 / 10');
});

test('Zahleneingabe: deutsche Schreibweise, Prüfung und Gewichtung', async ({ page }) => {
  await setEvaluation(page, { costs: true, utility: true });
  await page.click('[data-mode=edit]');
  const cost = page.getByLabel('Kosten von Durchlauferhitzer');
  await cost.fill('1.234,5');
  await cost.press('Tab');
  await expect(cost).toHaveValue('1234,5');
  await expect(cost).not.toHaveAttribute('aria-invalid');

  const score = page.getByLabel(/^Nutzwert von Durchlauferhitzer/);
  await score.fill('12');
  await expect(score).toHaveAttribute('aria-invalid');
  await score.fill('abc');
  await expect(score).toHaveAttribute('aria-invalid');
  await score.fill('7,5');
  await expect(score).not.toHaveAttribute('aria-invalid');

  const weight = page.getByLabel('Gewichtung von Wassererwärmung');
  await weight.fill('0');
  await weight.press('Tab');
  await expect(page.locator('.weight-pct').first()).toHaveText('0 %');
  await expect(page.locator('.weight-pct').nth(1)).toHaveText('33,3 %');
});

test('Unvollständige Werte: Preis-Leistung „–“ und Markierung', async ({ page }) => {
  await setEvaluation(page, { costs: true, utility: true });
  await page.click('[data-mode=edit]');
  const cost = page.getByLabel('Kosten von Thermoblock');
  await cost.fill('');
  await cost.press('Tab');
  const footer = await compareFooter(page);
  expect(footer[0]).toBe('Gesamtkosten 32,00 € * 57,00 € 133,00 €');
  expect(footer[2]).toBe('Preis-Leistung Kosten je Nutzwertpunkt – 9,91 € 17,54 €');
});

test('Skalenwechsel rechnet Nutzwerte auf Wunsch um', async ({ page }) => {
  await setEvaluation(page, { utility: true });
  page.once('dialog', d => d.accept());
  await setEvaluation(page, { scale: 5 });
  await expect(page.locator('.metrics')).toContainText('3,63 / 5');
  await page.click('[data-mode=edit]');
  await expect(page.locator('.num-input[aria-invalid]')).toHaveCount(0);
});

test('Ausgeschaltete Bewertung behält die Werte', async ({ page }) => {
  await setEvaluation(page, { costs: true });
  await page.click('[data-mode=edit]');
  await page.getByLabel('Kosten von Boiler').fill('99');
  await setEvaluation(page, { costs: false });
  await expect(page.locator('.num-input')).toHaveCount(0);
  await setEvaluation(page, { costs: true });
  await expect(page.getByLabel('Kosten von Boiler')).toHaveValue('99');
});

test('CSV enthält Bewertungsspalten', async ({ page }) => {
  await setEvaluation(page, { costs: true, utility: true });
  const { text } = await downloadText(page, 'export-csv');
  expect(text).toContain('"Kategorie";"Parameter";"Beschreibung des Parameters";"Gewicht";"Ausprägung";"Kosten (EUR)";"Nutzwert (0–10)";"Notiz"');
  expect(text).toContain('"Gesamtkosten (EUR)";"Nutzwert";"Kosten je Nutzwertpunkt (EUR)"');
  expect(text).toMatch(/"Kompakt-Espresso";.*;54;7,25;7,45/);
});
