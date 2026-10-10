import { test, expect, menu } from './fixtures.js';

/** Nutzwert aktivieren und Kriterien anlegen (das erste übernimmt die bisherigen Werte). */
async function setupCriteria(page, names) {
  await menu(page, 'settings');
  await page.check('#setUtility');
  await page.locator('.criteria-name').first().fill(names[0]);
  for (const n of names.slice(1)) {
    await page.click('#addCriterionBtn');
    await expect(page.locator('.criteria-name').last()).toBeFocused();
    await page.keyboard.type(n);
  }
}

test('Kriterien: Gewichte, Bewertung im Popover mit Enter-Navigation, Vergleich je Kriterium', async ({ page }) => {
  await setupCriteria(page, ['Geschmack', 'Komfort']);
  await expect(page.locator('.criteria-share')).toHaveText(['50 %', '50 %']);
  await page.locator('.criteria-weight').first().fill('75');
  await page.locator('.criteria-weight').last().fill('25');
  await expect(page.locator('.criteria-share')).toHaveText(['75 %', '25 %']);
  await page.click('#settingsDone');

  await page.click('[data-mode="edit"]');
  // Thermoblock hatte Nutzwert 8 → jetzt Geschmack 8, Komfort fehlt (teilweise bewertet)
  const btn = page.locator('[data-score-btn="p1o3"]');
  await expect(btn).toContainText('6');
  await expect(btn.locator('.score-partial')).toHaveText('1/2');
  await btn.click();
  const pop = page.locator('#scorePop');
  await expect(pop).toBeVisible();
  await expect(pop.locator('input').first()).toBeFocused();
  await page.keyboard.type('9'); // ersetzt die markierte 8
  await page.keyboard.press('Enter');
  await page.keyboard.type('5');
  await expect(pop.locator('.score-total b')).toHaveText('8'); // 0,75 × 9 + 0,25 × 5
  await page.keyboard.press('Enter'); // nach dem letzten Kriterium: nächste Ausprägung
  await expect(pop.locator('h3')).toHaveText('Nutzwert von „Induktion“');
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(btn).toContainText('8');
  await expect(btn.locator('.score-partial')).toHaveCount(0);

  // Konzeptvergleich: Zeilen je Kriterium
  await page.click('[data-mode="select"]');
  await expect(page.locator('#compareTable .crit-row th')).toHaveText(['Geschmack (75 %)', 'Komfort (25 %)']);

  // Rückgängig nimmt die Eingabe zurück
  await page.keyboard.press('Control+z');
  await page.click('[data-mode="edit"]');
  await expect(btn.locator('.score-partial')).toHaveText('1/2');
});

test('Bewertungstabelle: Werte aller Ausprägungen, ↓/Enter springen eine Zeile weiter', async ({ page }) => {
  await setupCriteria(page, ['Geschmack', 'Komfort']);
  await page.click('#scoreTableBtn');
  const dialog = page.locator('#scoreDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[data-r="0"][data-c="0"]')).toBeFocused();
  await page.keyboard.type('4');
  await page.keyboard.press('Enter');
  await expect(dialog.locator('input[data-r="1"][data-c="0"]')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(dialog.locator('input[data-r="0"][data-c="0"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.type('8');
  await expect(dialog.locator('tbody tr').nth(1).locator('td.num')).toHaveText('6'); // (4 + 8) / 2
  await page.click('#scoreDone');
  await page.click('#settingsDone');
  await page.click('[data-mode="edit"]');
  await expect(page.locator('[data-score-btn="p1o1"]')).toContainText('6');
});

test('Zurück auf ein Kriterium: wieder das einfache Zahlenfeld in der Zelle', async ({ page }) => {
  await setupCriteria(page, ['Geschmack', 'Komfort']);
  page.on('dialog', d => d.accept());
  await page.locator('.criteria-list .icon-btn.danger').last().click();
  await expect(page.locator('.criteria-name')).toHaveCount(1);
  await expect(page.locator('#scoreTableBtn')).toHaveCount(0);
  await page.click('#settingsDone');
  await page.click('[data-mode="edit"]');
  await expect(page.locator('[data-score-btn]')).toHaveCount(0);
  await expect(page.locator('.opt-cell.edit[data-oid="p1o3"] .metric-field input').last()).toHaveValue('8');
});

test('Popover bleibt beim Weiterblättern offen, auch wenn dafür gescrollt wird; Bildlauf sonst schließt', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 520 });
  await setupCriteria(page, ['Geschmack', 'Komfort']);
  await page.click('#settingsDone');
  await page.click('[data-mode="edit"]');
  await page.click('[data-score-btn="p1o4"]');
  const pop = page.locator('#scorePop');
  for (let i = 0; i < 4; i++) await pop.getByRole('button', { name: 'Nächste Ausprägung' }).click();
  await expect(pop).toBeVisible();
  await expect(pop.locator('h3')).toHaveText('Nutzwert von „Handhebel“');
  await expect(page.locator('[data-score-btn="p2o4"]')).toBeInViewport();
  await page.waitForTimeout(400); // nach der Schonfrist für das eigene Scrollen
  await page.mouse.wheel(0, 300);
  await expect(pop).toBeHidden();
});
