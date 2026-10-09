import { test, expect, setEvaluation } from './fixtures.js';

const inViewport = (page, sel) => page.locator(sel).evaluate(el => {
  const r = el.getBoundingClientRect();
  return r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
});

test('Neuaufbau erhält den Fokus: Vergleichsschalter, Sortierung, Legende im Verlauf', async ({ page }) => {
  await page.locator('#compareDiff').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#compareDiff')).toBeChecked();
  await expect(page.locator('#compareDiff')).toBeFocused();

  await setEvaluation(page, { costs: true, utility: true });
  await page.locator('#compareSort').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#compareSort')).toBeFocused();

  await page.click('[data-compare-view=chart]');
  const key = page.locator('.pc-key[data-cid=c3]');
  await key.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pc-key[data-cid=c3]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pc-key[data-cid=c3]')).toBeFocused();
});

test('Verträglichkeits-Popover: Bildlauf und Fokus bleiben nach dem Umschalten erhalten', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 520 });
  await page.click('[data-mode=edit]');
  const cell = page.locator('.opt-cell.edit[data-oid=p1o4]');
  await cell.hover();
  await cell.locator('[data-cons-btn]').click();
  const list = page.locator('#consPop .cons-pop-list');
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const before = await list.evaluate(el => el.scrollTop);
  expect(before).toBeGreaterThan(0);
  const btn = page.locator('#consPop').getByRole('button', { name: 'Bedingt verträglich: „Induktion“ und „Spülmaschinenfest“' });
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toBeFocused();
  expect(await page.locator('#consPop .cons-pop-list').evaluate(el => el.scrollTop)).toBe(before);
  expect(await inViewport(page, '#consPop')).toBe(true);
});

test('Schwebende Elemente bleiben im sichtbaren Bereich (schmales Fenster)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.click('#tabAddBtn');
  await expect(page.locator('#tabMenu')).toBeVisible();
  expect(await inViewport(page, '#tabMenu')).toBe(true);
  await page.keyboard.press('Escape');

  // Notiz am rechten Rand: Popover wird nach links verschoben
  const cell = page.locator('.opt-cell.pick[data-oid=p1o3]');
  await cell.scrollIntoViewIfNeeded();
  await cell.hover();
  await expect(page.locator('#notePop')).toBeVisible();
  expect(await inViewport(page, '#notePop')).toBe(true);
});

test('Werkzeugleisten verdecken die Textfelder von Parameter und Ausprägung nicht', async ({ page }) => {
  await page.click('[data-mode="edit"]');
  for (const [cell, field] of [['.param-cell', '.param-name'], ['.opt-cell.edit', 'textarea']]) {
    const c = page.locator(cell).nth(1);
    await c.hover();
    await expect(c.locator('.row-tools, .opt-tools').first()).toHaveCSS('opacity', '1');
    // Rechtes Ende der ersten Textzeile: hier lag die Leiste früher über dem Namen
    const free = await c.locator(field).first().evaluate(el => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.right - 6, r.top + 12) === el;
    });
    expect(free, `${cell}: Textfeld frei`).toBe(true);
  }
});
