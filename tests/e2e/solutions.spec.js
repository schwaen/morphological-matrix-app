import { test, expect, setEvaluation } from './fixtures.js';

test('Lösungsraum: Liste, Festlegen per Klick, Grenzen, Sortierung und als Konzept übernehmen', async ({ page }) => {
  await setEvaluation(page, { costs: true, utility: true });
  await page.click('#solutionsLink');
  const dialog = page.locator('#solutionsDialog');
  await expect(dialog).toBeVisible();
  const count = page.locator('#lsCount');
  await expect(count).toContainText('1.888 passende Kombinationen');
  await expect(page.locator('#lsTable tbody tr')).toHaveCount(50);

  // Klick auf eine Zelle legt die Ausprägung fest
  await page.locator('[data-fix="p5:p5o1"]').first().click();
  await expect(page.locator('.ls-chip')).toHaveText(/Energieversorgung:\s*Netzstrom/);
  await expect(count).toContainText('720 passende Kombinationen mit dieser Festlegung');
  await page.check('#lsLimits');
  await expect(count).toContainText('474 passende');

  // Sortierung nach Nutzwert: bester zuerst
  await page.selectOption('#lsSort', 'utility');
  const first = page.locator('#lsTable tbody tr').first();
  await expect(first.locator('td.num b')).toHaveText('8,5');
  await expect(first.locator('.ls-cell').first()).toHaveText('Induktion');

  // Weitere laden
  await page.click('#lsMore');
  await expect(page.locator('#lsTable tbody tr')).toHaveCount(100);

  // Als Konzept übernehmen: Zeile zeigt danach das Konzept
  await first.hover();
  await first.locator('.ls-take').click();
  await expect(first.locator('.ls-exists')).toHaveText('Lösung 4');
  await page.click('#lsDone');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#conceptList .concept')).toHaveCount(4);
  await expect(page.locator('#conceptList .concept.is-active .concept-name')).toHaveValue('Lösung 4');
  await expect(page.locator('[data-cell="p1:p1o4"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Lösungsraum: Auswahl eines Konzepts übernehmen, Festlegung lösen, Filter ohne Treffer', async ({ page }) => {
  await page.click('#solutionsBtn');
  await page.click('#lsFromConcept');
  await expect(page.locator('#lsCount')).toContainText('1 passende Kombination mit dieser Festlegung');
  await expect(page.locator('#lsTable tbody .ls-exists')).toHaveText('Kompakt-Espresso');
  // Festlegung über das Auswahlfeld, dann per × wieder lösen
  await page.locator('.ls-chip', { hasText: 'Reinigung' }).getByRole('button').click();
  await expect(page.locator('#lsCount')).toContainText('3 passende Kombinationen');
  await page.locator('.ls-chip').first().getByRole('button').click();
  await page.selectOption('#lsFixPick', { label: 'Muskelkraft' });
  await page.selectOption('#lsFixPick', { label: 'Induktion' });
  await expect(page.locator('#lsCount')).toContainText('0 passende');
  await expect(page.locator('.ls-empty')).toBeVisible();
});
