import { test, expect, APP_URL } from './fixtures.js';

/** Darstellung der Verbindungslinien je Konzept-ID. */
const lineStyles = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#lines path')]
  .map(p => [p.dataset.cid, { opacity: p.getAttribute('opacity'), width: p.getAttribute('stroke-width'), stroke: p.getAttribute('stroke') }])));

test('Linienmodus: Standard „Aktives“, Hervorhebung beim Darüberfahren, „Alle“ und „Aus“', async ({ page }) => {
  await expect(page.locator('[data-lines=active]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await lineStyles(page)).c1?.opacity).toBe('1');
  let s = await lineStyles(page);
  expect(s.c1).toMatchObject({ opacity: '1', width: '3' });
  expect(s.c2).toMatchObject({ opacity: '.12', width: '2' });

  // Darüberfahren hebt das Konzept hervor, alle anderen treten zurück
  await page.locator('.concept[data-cid=c2]').hover();
  s = await lineStyles(page);
  expect(s.c2).toMatchObject({ opacity: '1', width: '3' });
  expect(s.c3.opacity).toBe('.08');
  await page.locator('#title').hover();
  await expect.poll(async () => (await lineStyles(page)).c2?.opacity).toBe('.12');

  await page.click('[data-lines=all]');
  await expect.poll(async () => (await lineStyles(page)).c2?.opacity).toBe('.55');

  await page.click('[data-lines=off]');
  await expect(page.locator('#lines path')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-lines=off]')).toHaveAttribute('aria-pressed', 'true');
});

test('Alte Einstellung „Linien aus“ wird übernommen', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('morphologische-matrix:prefs', JSON.stringify({ mode: 'select', showLines: false })));
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(APP_URL);
  await expect(page.locator('[data-lines=off]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lines path')).toHaveCount(0);
});

test('Konzeptfarben: im dunklen Farbschema die passende dunkle Stufe', async ({ page }) => {
  await expect.poll(async () => (await lineStyles(page)).c1?.stroke).toBe('#2a78d6');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(async () => (await lineStyles(page)).c1.stroke).toBe('#3987e5');
  // Gespeichert bleibt die helle Farbe
  expect(await page.locator('.concept.is-active input[type=color]').inputValue()).toBe('#2a78d6');
});

test('Konzeptvergleich als Verlauf: Linienzüge, Legende, Tooltip, Ansicht bleibt erhalten', async ({ page }) => {
  await expect(page.locator('#compareChart')).toBeHidden();
  await page.click('[data-compare-view=chart]');
  await expect(page.locator('#compareTable')).toBeHidden();
  await expect(page.locator('#compareChart')).toBeVisible();
  await expect(page.locator('#compareChart .pc-concept')).toHaveCount(3);
  await expect(page.locator('#compareChart .pc-axis')).toHaveCount(6);
  await expect(page.locator('.pc-key')).toHaveText(['Kompakt-Espresso', 'Outdoor', 'Smart Home']);
  await expect(page.locator('.pc-concept[data-cid=c1]')).toHaveClass(/is-strong/);

  // Tooltip je Achse: Parameter und die Wahl jedes Konzepts
  await page.locator('.pc-hit').nth(1).hover();
  const tip = page.locator('.pc-tip');
  await expect(tip).toBeVisible();
  await expect(tip.locator('strong')).toHaveText('Druckerzeugung');
  await expect(tip.locator('li')).toHaveCount(3);

  // Legende: Darüberfahren hebt hervor, Klick wählt das aktive Konzept
  await page.locator('.pc-key', { hasText: 'Outdoor' }).hover();
  await expect(page.locator('.pc-concept[data-cid=c3]')).toHaveClass(/is-faint/);
  await page.locator('.pc-key', { hasText: 'Outdoor' }).click();
  await expect(page.locator('.concept.is-active')).toHaveAttribute('data-cid', 'c2');
  await expect(page.locator('.pc-key', { hasText: 'Outdoor' })).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.locator('[data-compare-view=chart]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#compareChart .pc-concept')).toHaveCount(3);

  await page.click('[data-compare-view=table]');
  await expect(page.locator('#compareTable')).toBeVisible();
  await expect(page.locator('#compareChart')).toBeHidden();
});
