import { test, expect, setEvaluation } from './fixtures.js';

const cell = (page, text) => page.locator('.opt-cell.pick', { hasText: text }).first();

test('MoSCoW ist optional: ohne Aktivierung keine Prioritäten sichtbar', async ({ page }) => {
  await expect(page.locator('.opt-cell .prio')).toHaveCount(0);
  await expect(page.locator('#autoConcepts')).toBeHidden();
  await page.click('[data-mode=edit]');
  await expect(page.locator('.opt-prio')).toHaveCount(0);
});

test('Priorität je Ausprägung setzen, wechseln und entfernen (mit Rückgängig)', async ({ page }) => {
  await setEvaluation(page, { moscow: true });
  await page.click('[data-mode=edit]');
  const boiler = page.locator('.opt-cell.edit').nth(1); // Wassererwärmung → Boiler
  await expect(boiler.locator('textarea')).toHaveValue('Boiler');
  const picker = boiler.locator('.opt-prio');
  await expect(picker.getByRole('button', { name: /Won't have/ })).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: /Should have/ }).click();
  await expect(picker.getByRole('button', { name: /Should have/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(picker.getByRole('button', { name: /Won't have/ })).toHaveAttribute('aria-pressed', 'false');
  // Erneuter Klick entfernt die Priorität
  await picker.getByRole('button', { name: /Should have/ }).click();
  await expect(picker.locator('[aria-pressed="true"]')).toHaveCount(0);
  await page.click('#undoBtn');
  await expect(picker.getByRole('button', { name: /Should have/ })).toHaveAttribute('aria-pressed', 'true');
});

test('Kombinieren: Kürzel je Ausprägung, Won\'t abgeschwächt aber wählbar', async ({ page }) => {
  await setEvaluation(page, { moscow: true });
  await expect(cell(page, 'Durchlauferhitzer').locator('.prio')).toHaveText('M');
  await expect(cell(page, 'Boiler')).toHaveClass(/is-wont/);
  // Negativ-Konzept: Won't lässt sich wählen
  await cell(page, 'Boiler').click();
  await expect(cell(page, 'Boiler')).toHaveClass(/is-active/);
  await expect(page.locator('#conceptSummary .prio-profile')).toContainText('1 × W');
  await expect(page.locator('#compareTable')).toContainText("enthält 1 × Won't");
});

test('Automatische Konzepte MVP, Standard und Premium', async ({ page }) => {
  await setEvaluation(page, { moscow: true });
  // Nur die MoSCoW-Gruppe ist sichtbar (Kosten und Nutzwert sind aus)
  await expect(page.locator('#autoMoscow')).toBeVisible();
  await expect(page.locator('[data-generate="max-utility"]')).toBeHidden();

  await page.click('[data-generate="moscow-must"]');
  await expect(page.locator('.concept.is-active .concept-name')).toHaveValue('MVP (Must-haves)');
  await expect(page.locator('.concept.is-active .concept-progress')).toHaveText('6/6');
  await expect(page.locator('#conceptSummary .prio-profile')).toContainText('6 × M');

  // Ohne Rückfall: Parameter ohne Should bleiben leer, mit Hinweis
  await page.click('[data-generate="moscow-should"]');
  await expect(page.locator('.concept.is-active .concept-name')).toHaveValue('Standard (Should-haves)');
  await expect(page.locator('.concept.is-active .concept-progress')).toHaveText('4/6');
  await expect(page.locator('#toast')).toContainText('2 Parameter blieben ohne Auswahl, da dort die Priorität „Should“ fehlt');

  await page.click('[data-generate="moscow-could"]');
  await expect(page.locator('.concept.is-active .concept-name')).toHaveValue('Premium (Could-haves)');
  await expect(page.locator('#compareTable')).toContainText('Priorität (MoSCoW)');
});
