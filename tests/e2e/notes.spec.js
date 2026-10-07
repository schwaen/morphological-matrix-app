import { test, expect } from './fixtures.js';

test('Notizen im Kombinieren-Modus: Symbol, Popover beim Überfahren, Zusammenfassung', async ({ page }) => {
  const thermo = page.locator('.opt-cell.pick[data-oid=p1o3]');
  await expect(thermo.locator('.note-ico')).toHaveCount(1);
  await expect(thermo).toHaveAttribute('aria-description', /Heizt in ca\. 30 s auf/);
  await expect(page.locator('.opt-cell.pick .note-ico')).toHaveCount(4);
  await expect(page.locator('.param-cell .note-ico')).toHaveCount(1);

  await thermo.hover();
  await expect(page.locator('#notePop')).toBeVisible();
  await expect(page.locator('#notePop')).toContainText('Notiz · Thermoblock');
  await page.locator('#title').hover();
  await expect(page.locator('#notePop')).toBeHidden();

  // Zusammenfassung: Begründung und Notizen der gewählten Ausprägungen
  await expect(page.locator('#conceptNote')).toHaveValue(/Günstigster Einstieg/);
  await expect(page.locator('#conceptSummary .dd-note')).toHaveText([/Heizt in ca\. 30 s/, /Bis 15 bar/]);
});

test('Notizen bearbeiten: Ausprägung, Parameter, leere Notiz verschwindet, Rückgängig', async ({ page }) => {
  await page.click('[data-mode=edit]');
  const boiler = page.locator('.opt-cell.edit[data-oid=p1o2]');
  await expect(boiler.locator('.opt-note')).toHaveCount(0);
  await boiler.hover();
  await boiler.getByRole('button', { name: 'Notiz hinzufügen' }).click();
  await expect(boiler.locator('.opt-note')).toBeFocused();
  await page.keyboard.type('Braucht lange zum Aufheizen');
  await page.locator('#description').click();
  await expect(boiler.getByRole('button', { name: 'Notiz bearbeiten' })).toHaveCount(1);

  // Leeres Notizfeld verschwindet beim Verlassen
  const pad = page.locator('.opt-cell.edit[data-oid=p3o3]');
  await pad.hover();
  await pad.getByRole('button', { name: 'Notiz hinzufügen' }).click();
  await page.locator('#description').click();
  await expect(pad.locator('.opt-note')).toHaveCount(0);

  // Beschreibung eines Parameters
  const param = page.locator('.param-cell[data-pid=p1]');
  await param.hover();
  await param.getByRole('button', { name: 'Beschreibung hinzufügen' }).click();
  await page.keyboard.type('Wie wird das Wasser erhitzt?');
  await page.locator('.stats').click();

  // Rückgängig entfernt die Beschreibung, Wiederholen bringt sie zurück
  await page.keyboard.press('Control+z');
  await expect(page.locator('.param-cell[data-pid=p1] .param-note')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.param-cell[data-pid=p1] .param-note')).toHaveValue('Wie wird das Wasser erhitzt?');

  await page.reload();
  await expect(page.locator('.opt-cell.edit[data-oid=p1o2] .opt-note')).toHaveValue('Braucht lange zum Aufheizen');
  await expect(page.locator('.param-cell[data-pid=p1] .param-note')).toHaveValue('Wie wird das Wasser erhitzt?');
});

test('Begründung je Konzept: Eingabe ohne Fokusverlust, Konzeptvergleich, Suche findet Notizen', async ({ page }) => {
  await page.locator('.concept[data-cid=c3]').click();
  const note = page.locator('#conceptNote');
  await expect(note).toHaveValue('');
  await note.click();
  await page.keyboard.type('Vernetzt, aber teuer');
  await expect(note).toBeFocused();
  await expect(note).toHaveValue('Vernetzt, aber teuer');
  const row = page.locator('#compareTable tr.note-row td');
  await expect(row).toHaveText([/Günstigster Einstieg/, /Für Camping/, 'Vernetzt, aber teuer']);

  // Suche bezieht Notizen von Ausprägungen und Parametern ein
  await page.locator('#matrixSearch').fill('folgekosten');
  await expect(page.locator('#searchCount')).toHaveText('1 Treffer');
  await expect(page.locator('.opt-cell.is-match')).toHaveAttribute('data-oid', 'p3o2');
  await page.locator('#matrixSearch').fill('crema');
  await expect(page.locator('.param-cell.is-match')).toHaveAttribute('data-pid', 'p2');
});
