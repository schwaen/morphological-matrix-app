import fs from 'node:fs';
import { test, expect, menu, setTitle, tabMenu } from './fixtures.js';

async function downloadBackup(page, testInfo) {
  await menu(page, 'open');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#backupExportBtn')]);
  expect(download.suggestedFilename()).toMatch(/^morphologische-matrizen-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  await expect(page.locator('#toast')).toContainText('Backup mit 2 Matrizen gespeichert');
  // Als Inhalt übergeben: Pfade mit Umlauten (aus dem Testnamen) setzt Playwright nicht zuverlässig
  return { name: download.suggestedFilename(), mimeType: 'application/zip', buffer: fs.readFileSync(path) };
}

const libraryTitles = page => page.locator('#docList .doc-title').evaluateAll(els => els.map(el => el.firstChild.textContent.trim()).sort());

test('Backup herunterladen und in einem leeren Browser wiederherstellen', async ({ page }, testInfo) => {
  await tabMenu(page, 'Neue leere Matrix');
  await setTitle(page, 'Mein Projekt');
  const file = await downloadBackup(page, testInfo);

  // Alles löschen – wie ein neuer Browser
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await menu(page, 'open');
  expect(await libraryTitles(page)).toEqual(['Beispiel: Kaffeemaschine']);

  await page.setInputFiles('#backupFile', file);
  await expect(page.locator('#toast')).toContainText('Wiederhergestellt: 1 neu, 1 bereits vorhanden');
  expect(await libraryTitles(page)).toEqual(['Beispiel: Kaffeemaschine', 'Mein Projekt']);

  // Erneut wiederherstellen ändert nichts
  await page.setInputFiles('#backupFile', file);
  await expect(page.locator('#toast')).toContainText('Wiederhergestellt: 2 bereits vorhanden');
  await expect(page.locator('#docList .doc')).toHaveCount(2);
});

test('Wiederherstellen überschreibt nie: abweichender Stand wird als Kopie angelegt', async ({ page }, testInfo) => {
  await tabMenu(page, 'Neue leere Matrix');
  await setTitle(page, 'Mein Projekt');
  const file = await downloadBackup(page, testInfo);
  await page.click('#libraryClose');
  await setTitle(page, 'Mein Projekt – neuer Stand');

  await menu(page, 'open');
  await page.setInputFiles('#backupFile', file);
  await expect(page.locator('#toast')).toContainText('1 als Kopie');
  expect(await libraryTitles(page)).toEqual(['Beispiel: Kaffeemaschine', 'Mein Projekt (aus Backup)', 'Mein Projekt – neuer Stand']);
  // Geöffneter Tab bleibt unverändert
  await expect(page.locator('#title')).toHaveValue('Mein Projekt – neuer Stand');
});

test('Einzelne JSON-Exporte lassen sich ebenfalls einlesen; ungültige Dateien werden gemeldet', async ({ page }) => {
  await menu(page, 'open');
  await page.setInputFiles('#backupFile', [
    { name: 'export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ title: 'Importiert', parameters: [] })) },
    { name: 'kaputt.json', mimeType: 'application/json', buffer: Buffer.from('{') },
  ]);
  await expect(page.locator('#toast')).toContainText('1 neu, 1 Datei nicht lesbar');
  // Die Meldung liegt im offenen Dialog (oberste Ebene), nicht hinter dessen Hintergrund
  await expect(page.locator('#libraryDialog #toast')).toBeVisible();
  await expect(page.locator('#docList')).toContainText('Importiert');
});
