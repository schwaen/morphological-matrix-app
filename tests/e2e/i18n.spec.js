import { test, expect, setEvaluation, APP_URL, exportFile } from './fixtures.js';

/** Sprache über das Menü „Datei“ wechseln (die Seite lädt dabei neu). */
async function chooseLanguage(page, lang) {
  await page.click('#menuBtn');
  await Promise.all([page.waitForEvent('load'), page.click(`[data-lang="${lang}"]`)]);
}

test('Sprache im Menü „Datei“ umschalten – geöffnete Tabs bleiben erhalten', async ({ page }) => {
  await expect(page.locator('#menuBtn')).toHaveText('Datei');
  await page.click('#tabAddBtn');
  await page.locator('#tabMenu button', { hasText: 'Neue leere Matrix' }).click();
  await expect(page.locator('.app-tab')).toHaveCount(2);

  await chooseLanguage(page, 'en');
  await expect(page.locator('#menuBtn')).toHaveText('File');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-mode=edit]')).toHaveText('Edit');
  await expect(page.locator('.app-tab')).toHaveCount(2);
  await page.click('#menuBtn');
  await expect(page.locator('[data-lang="en"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-lang="de"]')).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');

  // Die Wahl bleibt nach dem Neuladen erhalten; zurück auf Deutsch
  await page.reload();
  await expect(page.locator('#menuBtn')).toHaveText('File');
  await chooseLanguage(page, 'de');
  await expect(page.locator('#menuBtn')).toHaveText('Datei');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('Erster Start folgt der Browsersprache (Englisch, wenn nicht Deutsch)', async ({ browser }) => {
  for (const [locale, file] of [['en-US', 'File'], ['fr-FR', 'File'], ['de-AT', 'Datei']]) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto(APP_URL);
    await expect(page.locator('#menuBtn'), locale).toHaveText(file);
    await context.close();
  }
});

test('Englisch: Zahlen, Währung, Prozent, Eingabe und CSV im US-Format', async ({ page }) => {
  await chooseLanguage(page, 'en');
  await expect(page.locator('#stats')).toContainText('3,072');
  await setEvaluation(page, { costs: true, utility: true });
  await expect(page.locator('.opt-cell.pick', { hasText: 'Durchlauferhitzer' })).toContainText('€18.00');
  // Beschriftung „bester Wert“ kommt per CSS (::after) aus der Sprachdatei
  const best = await page.locator('#compareTable td.best').first().evaluate(el => getComputedStyle(el, '::after').content);
  expect(best).toBe('"Best"');

  await page.click('[data-mode=edit]');
  await expect(page.locator('.param-cell').first()).toContainText('25%');
  const cost = page.locator('.opt-cell.edit').first().locator('.num-input').first();
  await cost.fill('1,234.5');
  await cost.blur();
  await expect(cost).toHaveValue('1234.5');
  await page.click('[data-mode=select]');
  await expect(page.locator('.opt-cell.pick', { hasText: 'Durchlauferhitzer' })).toContainText('€1,234.50');

  const csv = await exportFile(page, 'csv');
  expect(csv.text).toContain('"Title","Beispiel: Kaffeemaschine"');
  expect(csv.text).toMatch(/"Kompakt-Espresso",.*,7\.25,/);
});

test('Englisch: keine deutschen Texte auf der Oberfläche', async ({ page }) => {
  await chooseLanguage(page, 'en');
  // Neue leere Matrix (die Beispiel-Inhalte sind deutsch und bleiben es)
  await page.click('#tabAddBtn');
  await page.locator('#tabMenu button', { hasText: 'New blank matrix' }).click();
  await page.locator('.app-tab').first().click({ button: 'middle' });
  await setEvaluation(page, { costs: true, utility: true, moscow: true });
  await page.click('[data-mode=edit]');
  await page.click('#addCategoryBtn');
  await page.click('[data-mode=select]');
  await page.click('[data-generate="moscow-must"]'); // Hinweis „ohne Auswahl“ erscheint
  await expect(page.locator('#toast')).toBeVisible();

  const leftovers = await page.evaluate(() => {
    const german = /[äöüÄÖÜß„]|\b(Ausprägung|Konzept|Kosten|Nutzwert|Kategorie|Bewertung|Speichern|Rückgängig|Löschen|Datei|Einklappen|Ausklappen|gewählt|Beispiel)\w*/;
    const found = [];
    const skip = el => el.closest('[lang="de"], script, style');
    // Sichtbare und unsichtbare Texte (auch Dialoge und Menüs)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent.trim();
      if (t && german.test(t) && !skip(walker.currentNode.parentElement)) found.push(t);
    }
    for (const el of document.querySelectorAll('[title], [aria-label], [placeholder]')) {
      if (skip(el)) continue;
      for (const a of ['title', 'aria-label', 'placeholder']) {
        const v = el.getAttribute(a);
        if (v && german.test(v)) found.push(`${a}: ${v}`);
      }
    }
    if (german.test(document.title)) found.push(`title: ${document.title}`);
    return found;
  });
  expect(leftovers).toEqual([]);
});
