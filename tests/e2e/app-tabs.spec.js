import { test, expect, menu, setTitle, tabMenu, APP_URL } from './fixtures.js';

const appTabs = page => page.locator('.app-tab');
const tabTitles = page => page.locator('.app-tab').evaluateAll(els =>
  els.map(el => (el.querySelector('#title') ? el.querySelector('#title').value : el.textContent).trim()));

test('Start mit einem Tab; der letzte Tab lässt sich nicht schließen', async ({ page }) => {
  await expect(appTabs(page)).toHaveCount(1);
  await expect(page.locator('.app-tab.is-active #title')).toHaveValue('Beispiel: Kaffeemaschine');
  await expect(page.locator('.tab-close')).toHaveCount(0);
});

test('Neue Matrix öffnet einen neuen Tab; Ansicht je Tab bleibt erhalten', async ({ page }) => {
  await tabMenu(page, 'Neue leere Matrix');
  await expect(appTabs(page)).toHaveCount(2);
  await expect(page.locator('#title')).toHaveValue('Neue morphologische Matrix');
  await expect(page.locator('[data-mode=edit]')).toHaveAttribute('aria-pressed', 'true');

  await appTabs(page).first().click();
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
  await expect(page.locator('[data-mode=select]')).toHaveAttribute('aria-pressed', 'true');

  await appTabs(page).nth(1).click();
  await expect(page.locator('[data-mode=edit]')).toHaveAttribute('aria-pressed', 'true');
});

test('Neue Matrix im Tab wird sofort gespeichert', async ({ page }) => {
  await tabMenu(page, 'Neue leere Matrix');
  const saved = await page.evaluate(() => {
    const id = JSON.parse(sessionStorage.getItem('morphologische-matrix:workspace')).active;
    return localStorage.getItem('morphologische-matrix:doc:' + id);
  });
  expect(saved).toContain('Neue morphologische Matrix');
});

test('Jeder Tab hat seinen eigenen Rückgängig-Verlauf', async ({ page }) => {
  await tabMenu(page, 'Neue leere Matrix');
  await page.click('#addParamBtn');
  await expect(page.locator('#undoBtn')).toBeEnabled();

  await appTabs(page).first().click();
  await expect(page.locator('#undoBtn')).toBeDisabled();

  await appTabs(page).nth(1).click();
  await expect(page.locator('#undoBtn')).toBeEnabled();
  await page.click('#undoBtn');
  await expect(page.locator('#stats')).toContainText('3 Parameter');
});

test('Umbenennen per Doppelklick', async ({ page }) => {
  await expect(page.locator('#title')).toHaveAttribute('readonly', '');
  await setTitle(page, 'Neuer Name');
  await expect(page.locator('#title')).toHaveValue('Neuer Name');
  await expect(page.locator('#title')).toHaveAttribute('readonly', '');
  await expect(page).toHaveTitle(/Neuer Name/);
});

test('Schließen aktiviert den Nachbarn; „Zuletzt geschlossen“ öffnet wieder', async ({ page }) => {
  await tabMenu(page, 'Neue leere Matrix');
  await setTitle(page, 'Zweite');
  await tabMenu(page, 'Neue leere Matrix');
  await setTitle(page, 'Dritte');
  expect(await tabTitles(page)).toEqual(['Beispiel: Kaffeemaschine', 'Zweite', 'Dritte']);

  await appTabs(page).nth(1).click();
  await page.locator('.app-tab.is-active .tab-close').click();
  expect(await tabTitles(page)).toEqual(['Beispiel: Kaffeemaschine', 'Dritte']);
  await expect(page.locator('#title')).toHaveValue('Dritte');

  await tabMenu(page, 'Zweite');
  expect(await tabTitles(page)).toEqual(['Beispiel: Kaffeemaschine', 'Dritte', 'Zweite']);
  await expect(page.locator('#title')).toHaveValue('Zweite');
});

test('Mittlere Maustaste schließt einen Tab', async ({ page }) => {
  await tabMenu(page, 'Neue leere Matrix');
  await appTabs(page).first().click({ button: 'middle' });
  await expect(appTabs(page)).toHaveCount(1);
  await expect(page.locator('#title')).toHaveValue('Neue morphologische Matrix');
});

test('Bereits geöffnete Matrix wird nicht doppelt geöffnet', async ({ page }) => {
  await tabMenu(page, 'Neue leere Matrix');
  await tabMenu(page, 'Aus „Meine Matrizen“ öffnen');
  await page.locator('#docList .doc', { hasText: 'Kaffeemaschine' }).getByRole('button', { name: 'Anzeigen' }).click();
  await expect(appTabs(page)).toHaveCount(2);
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
});

test('Tabs, aktiver Tab und Ansicht bleiben nach dem Neuladen erhalten', async ({ page }) => {
  await tabMenu(page, 'Neue leere Matrix');
  await setTitle(page, 'Zweite');
  await appTabs(page).first().click();
  await page.click('[data-mode=edit]');
  await page.reload();
  expect(await tabTitles(page)).toEqual(['Beispiel: Kaffeemaschine', 'Zweite']);
  await expect(page.locator('#title')).toHaveValue('Beispiel: Kaffeemaschine');
  await expect(page.locator('[data-mode=edit]')).toHaveAttribute('aria-pressed', 'true');
});

test('Tabs lassen sich per Ziehen umsortieren', async ({ page }) => {
  await tabMenu(page, 'Neue leere Matrix');
  await setTitle(page, 'Zweite');
  await appTabs(page).nth(1).dragTo(appTabs(page).first());
  expect(await tabTitles(page)).toEqual(['Zweite', 'Beispiel: Kaffeemaschine']);
  await page.reload();
  expect(await tabTitles(page)).toEqual(['Zweite', 'Beispiel: Kaffeemaschine']);
});

test('Geteilter Link öffnet einen neuen Tab', async ({ page, context }) => {
  await setTitle(page, 'Geteilt');
  await page.evaluate(() => { navigator.clipboard.writeText = async t => { window.__copied = t; }; });
  await menu(page, 'share');
  const link = await page.evaluate(() => window.__copied);
  const other = await context.newPage();
  await other.goto(link);
  // Der neue Browser-Tab übernimmt die zuletzt geöffneten App-Tabs und ergänzt die geteilte Matrix
  await expect(other.locator('#title')).toHaveValue('Geteilt');
  await expect(other.locator('.app-tab')).toHaveCount(2);
});

test('Änderung in anderem Browser-Tab: inaktiver Tab wird markiert und aktualisiert', async ({ page, context }) => {
  await tabMenu(page, 'Neue leere Matrix');               // Beispiel ist jetzt inaktiv
  const other = await context.newPage();
  await other.goto(APP_URL);
  await other.locator('.app-tab', { hasText: 'Kaffeemaschine' }).click();
  await setTitle(other, 'Von außen geändert');

  const dot = page.locator('.app-tab').first().locator('.tab-dot');
  await expect(dot).toBeVisible();
  await expect(page.locator('.app-tab').first()).toContainText('Von außen geändert');
  await page.locator('.app-tab').first().click();
  await expect(page.locator('#title')).toHaveValue('Von außen geändert');
  await expect(page.locator('.tab-dot')).toHaveCount(0);
});

test('Umstieg: bisher in diesem Browser-Tab bearbeitete Matrix wird zum ersten App-Tab', async ({ page }) => {
  await page.evaluate(() => {
    const id = 'alt123';
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('morphologische-matrix:doc:' + id, JSON.stringify({ savedAt: 1, data: { title: 'Alter Stand', parameters: [] } }));
    localStorage.setItem('morphologische-matrix:doc:neuer', JSON.stringify({ savedAt: 2, data: { title: 'Andere', parameters: [] } }));
    sessionStorage.setItem('morphologische-matrix:tab-doc', id);
  });
  await page.reload();
  await expect(appTabs(page)).toHaveCount(1);
  await expect(page.locator('#title')).toHaveValue('Alter Stand');
});

test('Handybreite: Tabs ohne seitliches Scrollen der Seite', async ({ page }) => {
  await tabMenu(page, 'Neue leere Matrix');
  await tabMenu(page, 'Beispiel öffnen');
  await page.locator('#exampleList .doc', { hasText: 'Kaffeemaschine' }).getByRole('button', { name: 'Öffnen' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('.app-tab.is-active')).toBeInViewport();
});
