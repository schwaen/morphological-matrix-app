import fs from 'node:fs';
import { test, expect, menu, downloadText, setTitle } from './fixtures.js';

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
  await setTitle(page, 'Geteilte Matrix');
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
  const activeId = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('morphologische-matrix:workspace')).active);
  const before = await activeId();
  expect(before).toBeTruthy();
  expect(await page.evaluate(id => localStorage.getItem('morphologische-matrix:doc:' + id), before)).toBeTruthy();
  await page.reload();
  expect(await activeId()).toBe(before);
});

test('Bibliothek: geöffnete Matrizen markiert, Öffnen als App-Tab, Löschen nur geschlossener', async ({ page }) => {
  await setTitle(page, 'Matrix A');
  await menu(page, 'new');
  await setTitle(page, 'Matrix B');
  await expect(page.locator('.app-tab')).toHaveCount(2);

  // Tab „Matrix A“ schließen – die Matrix bleibt in der Bibliothek
  await page.locator('.app-tab', { hasText: 'Matrix A' }).getByRole('button', { name: /schließen/ }).click();
  await expect(page.locator('.app-tab')).toHaveCount(1);

  await menu(page, 'open');
  const docs = page.locator('#docList .doc');
  await expect(docs).toHaveCount(2);
  const current = docs.filter({ hasText: 'Matrix B' });
  await expect(current).toContainText('aktiv');
  await expect(current.getByRole('button', { name: 'Matrix löschen' })).toHaveCount(0);
  await expect(current.locator('.icon-btn.danger')).toBeDisabled();

  const closed = docs.filter({ hasText: 'Matrix A' });
  await closed.getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.locator('.app-tab')).toHaveCount(2);
  await expect(page.locator('#title')).toHaveValue('Matrix A');

  // Bereits geöffnete Matrix: „Anzeigen“ wechselt nur den Tab
  await menu(page, 'open');
  await docs.filter({ hasText: 'Matrix B' }).getByRole('button', { name: 'Anzeigen' }).click();
  await expect(page.locator('.app-tab')).toHaveCount(2);
  await expect(page.locator('#title')).toHaveValue('Matrix B');

  // Löschen erst nach dem Schließen möglich
  await page.locator('.app-tab', { hasText: 'Matrix A' }).getByRole('button', { name: /schließen/ }).click();
  await menu(page, 'open');
  page.once('dialog', d => d.accept());
  await docs.filter({ hasText: 'Matrix A' }).locator('.icon-btn.danger').click();
  await expect(docs).toHaveCount(1);
});

test('Speichern beim Tippen gebündelt – Eingaben gehen beim Neuladen nicht verloren', async ({ page }) => {
  const stored = () => page.evaluate(() => {
    const id = JSON.parse(sessionStorage.getItem('morphologische-matrix:workspace')).active;
    return JSON.parse(localStorage.getItem('morphologische-matrix:doc:' + id)).data.description;
  });
  await page.locator('#description').fill('');
  await page.evaluate(() => {
    window.__writes = 0;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k.includes(':doc:')) window.__writes++; return orig.call(this, k, v); };
  });
  await page.locator('#description').pressSequentially('Neue Problemstellung', { delay: 5 });
  // Nach der Pause genau einmal gespeichert statt bei jedem Tastendruck
  await expect.poll(stored).toBe('Neue Problemstellung');
  expect(await page.evaluate(() => window.__writes)).toBeLessThanOrEqual(2);

  // Direkt nach dem Tippen neu laden (ohne Pause, ohne das Feld zu verlassen)
  await page.locator('#description').fill('Sofort neu geladen');
  await page.reload();
  await expect(page.locator('#description')).toHaveValue('Sofort neu geladen');
});

test('Ausstehende Eingaben werden vor einem Tab-Wechsel gespeichert', async ({ page }) => {
  await page.locator('#description').fill('Vor dem Wechsel');
  await page.click('#tabAddBtn');
  await page.locator('#tabMenu button', { hasText: 'Neue leere Matrix' }).click();
  const saved = await page.evaluate(() => {
    const ws = JSON.parse(sessionStorage.getItem('morphologische-matrix:workspace'));
    return JSON.parse(localStorage.getItem('morphologische-matrix:doc:' + ws.tabs[0].docId)).data.description;
  });
  expect(saved).toBe('Vor dem Wechsel');
});
