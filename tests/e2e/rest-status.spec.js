import { test, expect, tabMenu } from './fixtures.js';

const cell = (page, oid) => page.locator(`.opt-cell.pick[data-oid="${oid}"]`);

test('Restzahlen beim Kombinieren: je Ausprägung, in der Kennzahl und am Konzept', async ({ page }) => {
  await page.click('[data-mode="select"]');
  await page.click('#addConceptBtn');
  await cell(page, 'p5o4').click(); // nur „Muskelkraft“ gewählt
  await expect(cell(page, 'p3o2').locator('.rest')).toHaveText('16'); // Kapsel schließt Schwerkraft aus
  await expect(cell(page, 'p3o1').locator('.rest')).toHaveText('24');
  await expect(cell(page, 'p5o1').locator('.rest')).toHaveText('720'); // Wechsel auf Netzstrom
  await expect(cell(page, 'p3o2')).toHaveAttribute('aria-description', /16 widerspruchsfreie Lösungen, wenn gewählt/);
  // Direkt unverträgliche Ausprägungen sind durchgestrichen und tragen keine Zahl
  await expect(cell(page, 'p1o1')).toHaveClass(/is-blocked/);
  await expect(cell(page, 'p1o1').locator('.rest')).toHaveCount(0);
  await expect(page.locator('.stat-rest')).toHaveText('mit Auswahl: noch 88');
  await expect(page.locator('.concept.is-active .concept-rest')).toHaveText('noch 88 widerspruchsfreie Lösungen möglich');
  await expect(page.locator('#hint')).toContainText('Zahl an einer Ausprägung');
  // Vollständiges Konzept: keine Restzahlen (die Markierung sagt bereits alles)
  await page.locator('.concept[data-cid="c1"]').click();
  await expect(page.locator('.opt-cell .rest')).toHaveCount(0);
  await expect(page.locator('.stat-rest')).toHaveCount(0);
});

test('Restzahlen: ohne unverträgliche Paare und beim Bearbeiten ausgeblendet', async ({ page }) => {
  await page.click('[data-mode="edit"]');
  await expect(page.locator('.rest')).toHaveCount(0);
  await tabMenu(page, 'Neue leere Matrix');
  await page.click('[data-mode="select"]');
  await page.locator('.opt-cell.pick').first().click();
  await expect(page.locator('.opt-cell.pick')).not.toHaveCount(0);
  await expect(page.locator('.rest')).toHaveCount(0);
  await expect(page.locator('#hint')).not.toContainText('Zahl an einer Ausprägung');
});

test('Status je Konzept: Chip, Menü mit Grund, Kennzahl, Vergleich und Rückgängig', async ({ page }) => {
  // Im Beispiel: Kompakt-Espresso Favorit, Outdoor verworfen (mit Grund)
  await expect(page.locator('[data-status-btn="c1"]')).toHaveText('★ Favorit');
  await expect(page.locator('.concept[data-cid="c2"]')).toHaveClass(/is-dropped/);
  await expect(page.locator('.concept[data-cid="c2"] .status-why')).toContainText('Zielgruppe zu klein');
  await expect(page.locator('.stat-note')).toHaveText('1 Favorit · 1 verworfen');

  await page.click('[data-status-btn="c3"]');
  await expect(page.locator('#statusPop')).toBeVisible();
  await expect(page.locator('#statusPop input:checked')).toBeFocused();
  await page.locator('#statusPop label', { hasText: 'Gewählt' }).click();
  await expect(page.locator('[data-status-btn="c3"]')).toHaveText('✓ Gewählt');
  await page.locator('#statusPop textarea').fill('Beste Bedienung');
  await page.keyboard.press('Escape');
  await expect(page.locator('#statusPop')).toBeHidden();
  await expect(page.locator('[data-status-btn="c3"]')).toBeFocused();
  await expect(page.locator('.concept[data-cid="c3"] .status-why')).toHaveText('Beste Bedienung');
  await expect(page.locator('.stat-note')).toHaveText('1 gewählt · 1 Favorit · 1 verworfen');

  // Vergleich: verworfene Spalte abgeschwächt, auf Wunsch ausgeblendet
  await expect(page.locator('#compareTable thead th.is-dropped')).toHaveText(/Outdoor/);
  await page.check('#compareHideDropped');
  await expect(page.locator('#compareTable thead th')).toHaveCount(3);
  await page.uncheck('#compareHideDropped');

  // Rückgängig nimmt Grund und Status schrittweise zurück
  await page.click('#undoBtn');
  await expect(page.locator('.concept[data-cid="c3"] .status-why')).toHaveCount(0);
  await page.click('#undoBtn');
  await expect(page.locator('[data-status-btn="c3"]')).toHaveText('Entwurf');
});

test('Status bleibt nach dem Neuladen erhalten', async ({ page }) => {
  await page.click('[data-status-btn="c2"]');
  await page.locator('#statusPop label', { hasText: 'Favorit' }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('[data-status-btn="c2"]')).toHaveText('★ Favorit');
});
