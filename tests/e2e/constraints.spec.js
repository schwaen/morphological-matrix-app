/* global state, Consistency -- globale Variablen der App, nur innerhalb von page.evaluate */
import { test, expect, menu } from './fixtures.js';

const selectOutdoor = page => page.locator('.concept[data-cid=c2]').click({ position: { x: 5, y: 5 } });

test('Kombinieren: Konflikt, unverträgliche und bedingte Ausprägungen, Kennzahl, Liste, Zusammenfassung', async ({ page }) => {
  await expect(page.locator('.stat-sub')).toHaveText('davon widerspruchsfrei: 1.888');
  await expect(page.locator('.concept[data-cid=c2] .cons-pill')).toHaveText('⚠ 1');
  await expect(page.locator('.concept .cons-pill')).toHaveCount(1);

  await selectOutdoor(page);
  await expect(page.locator('.opt-cell.pick.is-conflict')).toHaveCount(2);
  await expect(page.locator('.opt-cell.pick.is-conflict[data-oid=p1o4] .cons-badge')).toHaveText('⚠ Konflikt');
  await expect(page.locator('.opt-cell.pick[data-oid=p4o3]')).toHaveClass(/is-blocked/);
  await expect(page.locator('.opt-cell.pick[data-oid=p3o4]')).toHaveClass(/is-conditional/);
  await expect(page.locator('.opt-cell.pick[data-oid=p4o2]')).not.toHaveClass(/is-blocked|is-conditional/);
  await expect(page.locator('.opt-cell.pick[data-oid=p4o3]')).toHaveAttribute('aria-description', /Unverträglich: mit „Muskelkraft“ \(Energieversorgung\) – Display braucht Strom/);

  await page.locator('.opt-cell.pick[data-oid=p4o3]').hover();
  await expect(page.locator('#notePop .pop-cons')).toContainText('Unverträglich');

  const box = page.locator('#conceptSummary .cons-box');
  await expect(box).toContainText('1 Unverträglichkeit');
  await expect(box).toContainText('Induktion braucht elektrische Leistung');
  await expect(box).not.toContainText('Bedingt verträglich');

  // Unverträgliche Ausprägungen bleiben wählbar; bedingte erscheinen als Hinweis
  await page.locator('.opt-cell.pick[data-oid=p4o3]').click();
  await expect(page.locator('.concept[data-cid=c2] .cons-pill')).toHaveText('⚠ 2');
  await page.locator('.opt-cell.pick[data-oid=p3o4]').click();
  await expect(box).toContainText('Bedingt verträglich');
  await expect(box).toContainText('Nur mit Handmühle');
});

test('Konzeptvergleich: Zeile Verträglichkeit und Konzepte mit Konflikt ausblenden', async ({ page }) => {
  const cells = page.locator('#compareTable tr.cons-row td');
  await expect(cells).toHaveText([/widerspruchsfrei/, /1 Konflikt.*Induktion ✕ Muskelkraft/, /widerspruchsfrei/]);
  await page.check('#compareHideConflicts');
  await expect(page.locator('#compareTable thead th')).toHaveCount(3);
  await expect(page.locator('#compareTable thead')).not.toContainText('Outdoor');
  await page.reload();
  await expect(page.locator('#compareHideConflicts')).toBeChecked();
});

test('Pflege an der Ausprägung: Popover, Begründung, Zähler, Rückgängig', async ({ page }) => {
  await page.click('[data-mode=edit]');
  const cell = page.locator('.opt-cell.edit[data-oid=p1o4]');
  await expect(cell.locator('.cons-count')).toHaveText('⊘ 2');
  await cell.hover();
  await cell.locator('[data-cons-btn]').click();
  const pop = page.locator('#consPop');
  await expect(pop).toBeVisible();
  await expect(pop.locator('h3')).toHaveText('Verträglichkeit von „Induktion“');
  await expect(pop.getByRole('button', { name: 'Unverträglich: „Induktion“ und „Muskelkraft“' })).toHaveAttribute('aria-pressed', 'true');

  await pop.getByRole('button', { name: 'Bedingt verträglich: „Induktion“ und „Pad“' }).click();
  await expect(pop.getByRole('button', { name: 'Bedingt verträglich: „Induktion“ und „Pad“' })).toHaveAttribute('aria-pressed', 'true');
  const note = pop.getByLabel('Begründung für „Induktion“ und „Pad“');
  await note.fill('Pads nur mit Adapter');
  await note.press('Enter');
  await expect(cell.locator('.cons-count')).toHaveText('⊘ 2! 1');

  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  expect(await page.evaluate(() => Consistency.get(state, 'p1o4', 'p3o3'))).toEqual({ a: 'p1o4', b: 'p3o3', type: 'conditional', note: 'Pads nur mit Adapter' });

  await page.keyboard.press('Control+z'); // Begründung
  await page.keyboard.press('Control+z'); // Paar
  await expect(cell.locator('.cons-count')).toHaveText('⊘ 2');
});

test('Verträglichkeitsmatrix: Klick wechselt, Detailbereich, Löschen räumt auf', async ({ page }) => {
  await menu(page, 'constraints');
  const dlg = page.locator('#consDialog');
  await expect(dlg).toBeVisible();
  await expect(page.locator('#consSummary')).toHaveText('12 Paare festgelegt · 3.072 Kombinationen, davon widerspruchsfrei: 1.888');
  const pair = dlg.locator('[data-pair="p1o4|p5o4"]');
  await expect(pair).toHaveText('✕');
  await pair.click(); // unverträglich → verträglich
  await expect(pair).toHaveText('');
  await expect(dlg.locator('.cons-detail')).toContainText('Betrifft: Outdoor');
  await pair.click(); // → bedingt
  await expect(pair).toHaveText('!');
  await dlg.locator('.cons-detail .cons-note').fill('Mit Generator möglich');
  await dlg.locator('.cons-detail .cons-note').press('Enter');
  await expect(page.locator('#consSummary')).toContainText('davon widerspruchsfrei: 1.932');
  await page.click('#consDone');
  await expect(page.locator('.concept .cons-pill')).toHaveCount(0);

  // Gelöschte Ausprägungen nehmen ihre Paare mit
  await page.click('[data-mode=edit]');
  const muskel = page.locator('.opt-cell.edit[data-oid=p5o4]');
  await muskel.hover();
  await muskel.getByRole('button', { name: 'Ausprägung löschen' }).click();
  expect(await page.evaluate(() => state.constraints.some(c => c.a === 'p5o4' || c.b === 'p5o4'))).toBe(false);
});

test('Zufällig erzeugt nur verträgliche Kombinationen', async ({ page }) => {
  for (let i = 0; i < 15; i++) {
    await page.locator('#randomBtn').click();
    expect(await page.evaluate(() => Consistency.conflicts(state, state.concepts.find(c => c.id === state.activeConceptId)).excluded.length)).toBe(0);
  }
});
