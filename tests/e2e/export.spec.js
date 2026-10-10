import { test, expect, menu, exportFile, setEvaluation } from './fixtures.js';

test('Menü „Datei“: ein Eintrag „Exportieren …“ statt CSV und Drucken; JSON bleibt eigenständig', async ({ page }) => {
  await page.click('#menuBtn');
  await expect(page.locator('#menuList [data-action="export"]')).toContainText('Exportieren …');
  await expect(page.locator('#menuList [data-action="export-json"]')).toBeVisible();
  await expect(page.locator('#menuList [data-action="export-csv"], #menuList [data-action="print"]')).toHaveCount(0);
});

test('Bericht als HTML: Inhalt nach Auswahl, Datei eigenständig; Auswahl wird gemerkt', async ({ page }) => {
  await setEvaluation(page, { costs: true, utility: true });
  await menu(page, 'export');
  const dialog = page.locator('#exportDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.export-file')).toHaveText('Datei: beispiel-kaffeemaschine.html');
  // Kosten/Nutzen nur bei HTML; „Verworfene weglassen“, weil ein Konzept verworfen ist
  await expect(dialog.locator('[data-part="chart"]')).toBeVisible();
  await dialog.locator('[data-part="hideDropped"]').check();
  await dialog.locator('[data-part="constraints"]').uncheck();
  await page.keyboard.press('Escape');

  const { name, text } = await exportFile(page, 'html');
  expect(name).toBe('beispiel-kaffeemaschine.html');
  expect(text).toMatch(/^<!doctype html>/);
  expect(text).toContain('<h2>Lösungskonzepte</h2>');
  expect(text).toContain('<h2>Kosten und Nutzwert</h2>');
  expect(text).not.toContain('<h2>Verträglichkeiten</h2>');
  expect(text).toContain('1 verworfenes Konzept nicht aufgeführt.');
  expect(text).not.toMatch(/<script|<link /); // eigenständig, ohne Skripte und externe Dateien

  // Auswahl bleibt nach dem Neuladen erhalten
  await page.reload();
  await menu(page, 'export');
  await expect(page.locator('#exportDialog input[value="html"]')).toBeChecked();
  await expect(page.locator('#exportDialog [data-part="constraints"]')).not.toBeChecked();
});

test('Bericht als Markdown, Tabelle als CSV, Drucken über den Dialog', async ({ page }) => {
  const md = await exportFile(page, 'md');
  expect(md.name).toBe('beispiel-kaffeemaschine.md');
  expect(md.text).toMatch(/^# Beispiel: Kaffeemaschine/);
  expect(md.text).not.toContain('Kosten und Nutzwert'); // Diagramm nur im HTML-Bericht

  const csv = await exportFile(page, 'csv');
  expect(csv.name).toBe('beispiel-kaffeemaschine.csv');
  await expect(page.locator('#exportDialog')).toBeHidden();

  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await menu(page, 'export');
  await page.locator('#exportDialog input[value="print"]').check();
  await expect(page.locator('#exportDialog .export-parts')).toHaveCount(0);
  await expect(page.locator('#exportRun')).toHaveText('Drucken …');
  await page.click('#exportRun');
  await expect(page.locator('#exportDialog')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(1);
});
