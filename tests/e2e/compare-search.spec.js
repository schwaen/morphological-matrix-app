import { test, expect, setEvaluation } from './fixtures.js';

const headers = page => page.locator('#compareTable thead th').evaluateAll(els => els.slice(1).map(el => el.textContent.trim()));
const paramRows = page => page.locator('#compareTable tbody tr:not(.cat-row):not(.note-row):not(.cons-row) th');

test('Konzeptvergleich: nur Unterschiede zeigen', async ({ page }) => {
  await expect(paramRows(page)).toHaveCount(6);
  // Alle Konzepte wählen bei „Reinigung“ dasselbe
  await page.evaluate(() => {
    const id = JSON.parse(sessionStorage.getItem('morphologische-matrix:workspace')).active;
    const key = 'morphologische-matrix:doc:' + id;
    const doc = JSON.parse(localStorage.getItem(key));
    const p = doc.data.parameters.find(x => x.name === 'Reinigung');
    doc.data.concepts.forEach(c => { c.selections[p.id] = p.options[0].id; });
    localStorage.setItem(key, JSON.stringify(doc));
  });
  await page.reload();
  await expect(page.locator('.compare-diff-count')).toHaveText('5 von 6 Parametern unterschiedlich');
  await page.check('#compareDiff');
  await expect(paramRows(page)).toHaveCount(5);
  await expect(page.locator('#compareTable tbody')).not.toContainText('Reinigung');
  // Gilt auch für den Verlauf
  await page.click('[data-compare-view=chart]');
  await expect(page.locator('#compareChart .pc-axis')).toHaveCount(5);
  // Bleibt nach dem Neuladen erhalten
  await page.reload();
  await expect(page.locator('#compareDiff')).toBeChecked();
});

test('Konzeptvergleich: Sortierung nach Kennzahlen mit Rang', async ({ page }) => {
  await expect(page.locator('#compareSort')).toHaveCount(0); // ohne Bewertung keine Sortierung
  await setEvaluation(page, { costs: true, utility: true });
  await expect(page.locator('#compareSort option')).toHaveText([
    'Reihenfolge der Liste', 'Nutzwert (höchster zuerst)', 'Gesamtkosten (niedrigste zuerst)', 'Preis-Leistung (beste zuerst)']);
  expect(await headers(page)).toEqual(['Kompakt-Espresso', 'Outdoor', 'Smart Home']);

  await page.selectOption('#compareSort', 'utility');
  await expect.poll(() => headers(page)).toEqual(['1.Smart Home', '2.Kompakt-Espresso', '3.Outdoor']);
  await page.selectOption('#compareSort', 'cost');
  await expect.poll(() => headers(page)).toEqual(['1.Kompakt-Espresso', '2.Outdoor', '3.Smart Home']);
  // Kennzahlen wandern mit ihrem Konzept
  await expect(page.locator('#compareTable tfoot tr').first().locator('td').first()).toHaveClass(/best/);

  await page.reload();
  await expect(page.locator('#compareSort')).toHaveValue('cost');
  // Bewertung aus: zurück zur Reihenfolge der Liste
  await setEvaluation(page, { costs: false, utility: false });
  expect(await headers(page)).toEqual(['Kompakt-Espresso', 'Outdoor', 'Smart Home']);
});

test('Suche: Treffer markieren, springen, eingeklappte Kategorien öffnen, Esc leert', async ({ page }) => {
  await page.locator('.cat-nav-actions button').nth(1).click(); // alle einklappen
  await page.keyboard.press('Control+f');
  await expect(page.locator('#matrixSearch')).toBeFocused();
  await page.keyboard.type('PUMPE');
  await expect(page.locator('#searchCount')).toHaveText('2 Treffer');
  await expect(page.locator('.cat-chip .search-badge')).toHaveText(['2 Treffer']);
  await expect(page.locator('.cat-band .search-badge')).toHaveText(['2 Treffer']);

  await page.keyboard.press('Enter');
  await expect(page.locator('#searchCount')).toHaveText('1 / 2');
  await expect(page.locator('.cat-band').first()).not.toHaveClass(/is-collapsed/);
  await expect(page.locator('.opt-cell.is-current-match')).toHaveText('Vibrationspumpe');
  await expect(page.locator('.opt-cell.is-match')).toHaveCount(2);
  await expect(page.locator('.param-cell.is-dim')).toHaveCount(2); // übrige Parameter der Kategorie
  await page.keyboard.press('Enter');
  await expect(page.locator('.opt-cell.is-current-match')).toHaveText('Rotationspumpe');
  await page.keyboard.press('Shift+Enter');
  await expect(page.locator('#searchCount')).toHaveText('1 / 2');

  // Auch im Bearbeiten-Modus und für Parameternamen; ohne Akzente
  await page.click('[data-mode=edit]');
  await page.locator('#matrixSearch').fill('wassererwarmung');
  await expect(page.locator('#searchCount')).toHaveText('1 Treffer');
  await expect(page.locator('.param-cell.is-match')).toHaveCount(1);

  await page.locator('#matrixSearch').fill('xyz');
  await expect(page.locator('#searchCount')).toHaveText('Keine Treffer');
  await expect(page.locator('#searchNext')).toBeDisabled();

  await page.locator('#matrixSearch').press('Escape');
  await expect(page.locator('#matrixSearch')).toHaveValue('');
  await expect(page.locator('.is-dim, .is-match')).toHaveCount(0);
});
