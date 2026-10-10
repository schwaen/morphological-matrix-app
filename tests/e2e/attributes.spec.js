import { test, expect, menu } from './fixtures.js';

// Das Beispiel „Kaffeemaschine“ hat zwei Merkmale: Gewicht (Dezimalzahl, kg, Summe, Warnung über 4)
// und Lautstärke (Ganzzahl, dB, Maximum, Warnung über 65).

test('Merkmale: Werte direkt in der Zelle, Ganzzahl-Prüfung, Kombinieren und Vergleich mit Warnung', async ({ page }) => {
  await page.click('[data-mode="edit"]');
  const cell = page.locator('.opt-cell.edit[data-oid="p2o2"]');
  await expect(cell.locator('.attr-name')).toHaveText(['Gewicht', 'Lautstärke']);
  const db = cell.getByLabel('Lautstärke von Vibrationspumpe');
  await expect(db).toHaveValue('72');
  await db.fill('60,5');
  await expect(db).toHaveAttribute('aria-invalid', 'true'); // nur ganze Zahlen
  await db.fill('60');
  await expect(db).not.toHaveAttribute('aria-invalid');
  await db.press('Enter');

  // Kombinieren: kleine Zeile mit den Werten
  await page.click('[data-mode="select"]');
  await expect(page.locator('[data-cell="p2:p2o2"] .opt-attrs-view')).toHaveText('0,3 kg · 60 dB');

  // Vergleich: Abschnitt „Eigene Merkmale“, Smart Home überschreitet das Gewicht
  const rows = page.locator('#compareTable .attr-row');
  await expect(rows.locator('th')).toHaveText(['Gewicht (Summe)', 'Lautstärke (Maximum)']);
  await expect(rows.first().locator('td')).toHaveText(['1,2 kg', '2,7 kg', '4,7 kg⚠ über 4,0 kg']);
  await expect(rows.nth(1).locator('td').first()).toHaveText('60 dB');
  await expect(rows.nth(1).locator('.attr-warn')).toHaveCount(0);

  // Sortieren nach Gewicht (leichtestes zuerst)
  await page.selectOption('#compareSort', { label: 'Gewicht (niedrigstes zuerst)' });
  await expect(page.locator('#compareTable thead th .rank')).toHaveText(['1.', '2.', '3.']);
  await expect(rows.first().locator('td')).toHaveText(['1,2 kg', '2,7 kg', '4,7 kg⚠ über 4,0 kg']);
  await page.selectOption('#compareSort', { label: 'Gewicht (höchstes zuerst)' });
  await expect(rows.first().locator('td').first()).toContainText('4,7 kg');

  // Zusammenfassung in der Seitenleiste
  await expect(page.locator('#conceptSummary .metric-attr')).toHaveCount(2);
});

test('Merkmale definieren: Auswahl mit Stufen, ab drei Merkmalen Popover mit Enter-Navigation und Tabelle', async ({ page }) => {
  await menu(page, 'settings');
  await page.click('#addAttributeBtn');
  await expect(page.locator('.attr-item.is-open [data-attr-name]')).toBeFocused();
  await page.keyboard.type('Reifegrad');
  await page.selectOption('.attr-item.is-open [data-attr-type]', 'choice');
  const levels = page.locator('.attr-item.is-open [data-level]');
  await levels.nth(0).fill('Idee');
  await levels.nth(1).fill('Prototyp');
  await page.click('.attr-item.is-open [data-add-level]');
  await expect(levels.nth(2)).toBeFocused();
  await page.keyboard.type('Serie');
  await page.selectOption('.attr-item.is-open [data-attr-limit-op]', 'level');
  await page.selectOption('.attr-item.is-open select[data-attr-limit]', { label: 'Idee' });
  await expect(page.locator('.attr-item.is-open .attr-title small')).toHaveText('Auswahl (Stufen) · je Konzept: höchste Stufe · ⚠ ab Stufe „Idee“');
  await page.click('#settingsDone');

  // Drei Merkmale: Knopf statt Felder
  await page.click('[data-mode="edit"]');
  const btn = page.locator('[data-attr-btn="p1o3"]');
  await expect(btn).toContainText('0,6 kg');
  await expect(btn.locator('.attr-filled')).toHaveText('1/3');
  await btn.click();
  const pop = page.locator('#attrPop');
  await expect(pop).toBeVisible();
  await expect(pop.locator('[data-attr-field="0"]')).toBeFocused();
  await page.keyboard.type('0,7');
  await page.keyboard.press('Enter');
  await expect(pop.locator('[data-attr-field="1"]')).toBeFocused();
  await page.keyboard.type('40');
  await page.keyboard.press('Enter');
  await pop.locator('[data-attr-field="2"]').selectOption({ label: 'Prototyp' });
  await page.keyboard.press('Enter'); // nach dem letzten Merkmal: nächste Ausprägung
  await expect(pop.locator('h3')).toHaveText('Merkmale von „Induktion“');
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(btn).toContainText('0,7 kg · 40 dB · Prototyp');
  await expect(btn.locator('.attr-filled')).toHaveText('3/3');

  // Tabelle mit Reiter „Eigene Merkmale“
  await btn.click();
  await pop.getByRole('button', { name: 'Tabelle aller Ausprägungen …' }).click();
  const dialog = page.locator('#scoreDialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#scoreHeading')).toHaveText('Eigene Merkmale');
  await expect(dialog.locator('[data-r="0"][data-c="0"]')).toBeFocused();
  await page.keyboard.type('0,5');
  await page.keyboard.press('Enter');
  await expect(dialog.locator('[data-r="1"][data-c="0"]')).toBeFocused();
  await page.click('#scoreDone');
  await expect(page.locator('[data-attr-btn="p1o1"]')).toContainText('0,5 kg');

  // Vergleich: Stufe und Warnung
  await page.click('[data-mode="select"]');
  const row = page.locator('#compareTable .attr-row').nth(2);
  await expect(row.locator('th')).toHaveText('Reifegrad (höchste Stufe)');
  await expect(row.locator('td').first()).toHaveText('Prototyp⚠ ab Stufe „Idee“');
});

test('Merkmal löschen fragt nach und lässt sich rückgängig machen; Suche findet Textwerte', async ({ page }) => {
  await menu(page, 'settings');
  await page.click('#addAttributeBtn');
  await page.keyboard.type('Material');
  await page.selectOption('.attr-item.is-open [data-attr-type]', 'text');
  await page.click('#settingsDone');
  await page.click('[data-mode="edit"]');
  // Drei Merkmale → Popover
  await page.locator('[data-attr-btn="p1o4"]').click();
  await page.locator('#attrPop [data-attr-field="2"]').fill('Edelstahl');
  await page.keyboard.press('Escape');
  await page.fill('#matrixSearch', 'edelstahl');
  await expect(page.locator('.opt-cell.is-match')).toHaveCount(1);
  await page.fill('#matrixSearch', '');

  await menu(page, 'settings');
  page.once('dialog', d => d.accept());
  await page.locator('.attr-item').filter({ hasText: 'Material' }).getByRole('button', { name: 'Merkmal löschen' }).click();
  await expect(page.locator('.attr-item')).toHaveCount(2);
  await page.click('#settingsDone');
  await page.keyboard.press('Control+z');
  await menu(page, 'settings');
  await expect(page.locator('.attr-item')).toHaveCount(3);
});
