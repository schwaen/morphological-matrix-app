import fs from 'node:fs';
import { test, expect, menu, downloadText } from './fixtures.js';

test('JSON-Export und -Import ergeben dieselbe Matrix', async ({ page }) => {
  const exported = await downloadText(page, 'export-json');
  expect(exported.name).toBe('beispiel-kaffeemaschine.json');
  await menu(page, 'new');
  await page.setInputFiles('#importFile', exported.path);
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
  await expect(page.locator('#stats')).toContainText('3.072 mögliche Kombinationen');
});

test('Import einer ungültigen Datei meldet einen Fehler', async ({ page }, info) => {
  const file = info.outputPath('kaputt.json');
  fs.writeFileSync(file, '{"foo": 1}');
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toContainText('Datei konnte nicht gelesen werden');
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
});

test('Import einer Datei aus einer neueren App-Version wird abgelehnt', async ({ page }, info) => {
  const file = info.outputPath('neu.json');
  fs.writeFileSync(file, JSON.stringify({ version: 999, title: 'Zukunft', parameters: [] }));
  await page.setInputFiles('#importFile', file);
  await expect(page.locator('#toast')).toContainText('neueren Version der App');
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
});

test('CSV-Export enthält Matrix und Konzepte (Excel-kompatibel)', async ({ page }) => {
  const { name, text } = await downloadText(page, 'export-csv');
  expect(name).toBe('beispiel-kaffeemaschine.csv');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('"Kategorie";"Parameter";"Ausprägung 1"');
  expect(text).toContain('"Brühsystem";"Wassererwärmung";"Durchlauferhitzer";"Boiler";"Thermoblock";"Induktion"');
  expect(text).toContain('"Kompakt-Espresso";"Thermoblock";"Vibrationspumpe"');
});

test('Teilen-Link öffnet die Matrix als neue Matrix', async ({ page, context }) => {
  await page.locator('#title').fill('Geteilte Matrix');
  await page.evaluate(() => {
    window.__copied = null;
    navigator.clipboard.writeText = async t => { window.__copied = t; };
  });
  await menu(page, 'share');
  const link = await page.evaluate(() => window.__copied);
  expect(link).toContain('#m=');
  const other = await context.newPage();
  await other.goto(link);
  await expect(other.locator('#title')).toHaveValue('Geteilte Matrix');
  expect(other.url()).not.toContain('#m=');
});

test('Daten der alten Version werden übernommen', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('morphologische-matrix:v1', JSON.stringify({
      title: 'Alt', parameters: [{ name: 'P', options: ['a', 'b'] }], concepts: [],
    }));
  });
  await page.reload();
  await expect(page.locator('#title')).toHaveValue('Alt');
  expect(await page.evaluate(() => localStorage.getItem('morphologische-matrix:v1'))).toBeNull();
});

test('Startmatrix wird sofort gespeichert (stabil nach Neuladen)', async ({ page }) => {
  const before = await page.evaluate(() => sessionStorage.getItem('morphologische-matrix:tab-doc'));
  expect(before).toBeTruthy();
  await page.reload();
  expect(await page.evaluate(() => sessionStorage.getItem('morphologische-matrix:tab-doc'))).toBe(before);
});

test('Bibliothek: Matrizen öffnen, in neuem Tab öffnen, löschen', async ({ page, context }) => {
  await page.locator('#title').fill('Matrix A');
  await menu(page, 'new');
  await page.locator('#title').fill('Matrix B');
  await menu(page, 'open');
  const docs = page.locator('#docList .doc');
  await expect(docs).toHaveCount(2);
  await expect(docs.first()).toContainText('dieser Tab');

  const other = docs.filter({ hasText: 'Matrix A' });
  const [tab] = await Promise.all([context.waitForEvent('page'), other.locator('a.btn').click()]);
  await expect(tab.locator('#title')).toHaveValue('Matrix A');
  expect(tab.url()).not.toContain('doc=');
  await tab.close();

  page.once('dialog', d => d.accept());
  await other.locator('.icon-btn.danger').click();
  await expect(docs).toHaveCount(1);
});
