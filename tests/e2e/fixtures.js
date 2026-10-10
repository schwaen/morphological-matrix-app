import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';

/** Gebaute App, ausgeliefert von `vite preview` (siehe playwright.config.js). */
export const APP_URL = 'http://localhost:4173/';

/**
 * `page` öffnet die App mit leerem Speicher und lässt den Test bei jedem
 * JavaScript-Fehler der Seite fehlschlagen.
 */
export const test = base.extend({
  // Playwright verlangt hier ein Objektmuster als ersten Parameter
  // eslint-disable-next-line no-empty-pattern
  pageErrors: async ({}, use) => { await use([]); },
  page: async ({ page, pageErrors }, use) => {
    page.on('pageerror', e => pageErrors.push(e.message));
    await openFresh(page);
    await use(page);
    expect(pageErrors, 'JavaScript-Fehler auf der Seite').toEqual([]);
  },
});
export { expect };

export async function openFresh(page, query = '') {
  await page.goto(APP_URL + query);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

/** Öffnet einen Eintrag im Menü „Datei“. */
export async function menu(page, action) {
  await page.click('#menuBtn');
  await page.click(`[data-action="${action}"]`);
}

/** Titel der aktiven Matrix ändern (Doppelklick auf den Tab, eintippen, Enter). */
export async function setTitle(page, text) {
  await page.locator('#title').dblclick();
  await page.locator('#title').fill(text);
  await page.locator('#title').press('Enter');
}

/** Eintrag im Menü „+“ der Tab-Leiste wählen. */
export async function tabMenu(page, label) {
  await page.click('#tabAddBtn');
  await page.locator('#tabMenu button', { hasText: label }).first().click();
}

/** Schaltet Kosten, Nutzwert und/oder Priorität (MoSCoW) im Bewertungsdialog. */
export async function setEvaluation(page, { costs, utility, scale, moscow } = {}) {
  await menu(page, 'settings');
  if (costs != null) await page.setChecked('#setCosts', costs);
  if (utility != null) await page.setChecked('#setUtility', utility);
  if (moscow != null) await page.setChecked('#setMoscow', moscow);
  if (scale != null) await page.selectOption('#setScale', String(scale));
  await page.click('#settingsDone');
}

/** Datei über „Datei → Exportieren …“ im gewählten Format (html, md, csv) herunterladen. */
export async function exportFile(page, format) {
  await menu(page, 'export');
  await page.locator(`#exportDialog input[name="exportFormat"][value="${format}"]`).check();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportRun')]);
  return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), 'utf8'), path: await dl.path() };
}

export async function downloadText(page, action) {
  await page.click('#menuBtn');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`[data-action="${action}"]`)]);
  return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), 'utf8'), path: await dl.path() };
}

/** Inhalt des Fußbereichs im Konzeptvergleich, je Zeile normalisiert. */
export function compareFooter(page) {
  return page.evaluate(() => [...document.querySelectorAll('#compareTable tfoot tr')]
    .map(r => r.innerText.replace(/\s+/g, ' ').trim()));
}

/** Gespeicherte Daten der Matrix im aktiven App-Tab. */
export function storedMatrix(page) {
  return page.evaluate(() => {
    const id = JSON.parse(sessionStorage.getItem('morphologische-matrix:workspace')).active;
    return JSON.parse(localStorage.getItem('morphologische-matrix:doc:' + id)).data;
  });
}
