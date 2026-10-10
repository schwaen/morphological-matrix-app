import { test, expect, setEvaluation, compareFooter, storedMatrix } from './fixtures.js';

/** Prüft alle verträglichen Kombinationen der gespeicherten Matrix durch (Referenz für die Optimierung). */
function bruteForce(m) {
  const W = m.parameters.reduce((s, p) => s + (p.weight ?? 1), 0);
  const r = { minC: Infinity, maxC: -Infinity, minU: Infinity, maxU: -Infinity, bestRatio: Infinity };
  const excluded = (m.constraints || []).filter(c => c.type === 'excluded');
  const chosen = [];
  const rec = (i, C, U) => {
    if (i === m.parameters.length) {
      if (excluded.some(c => chosen.includes(c.a) && chosen.includes(c.b))) return;
      const u = U / W;
      r.minC = Math.min(r.minC, C); r.maxC = Math.max(r.maxC, C);
      r.minU = Math.min(r.minU, u); r.maxU = Math.max(r.maxU, u);
      r.bestRatio = Math.min(r.bestRatio, C / u);
      return;
    }
    const p = m.parameters[i];
    for (const o of p.options) {
      chosen.push(o.id);
      rec(i + 1, C + o.cost, U + (p.weight ?? 1) * o.scores.nw); // ein Kriterium „Nutzwert“
      chosen.pop();
    }
  };
  rec(0, 0, 0);
  return r;
}

const de = (n, digits = 2) => n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: digits });
// Geschützte Leerzeichen wie in der normalisierten Tabellenausgabe durch normale ersetzen
const euro = n => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }).replace(/\s/g, ' ');

test('Knöpfe erscheinen nur bei passender Bewertung', async ({ page }) => {
  const visible = () => page.evaluate(() => [...document.querySelectorAll('[data-generate]')]
    .filter(b => !b.hidden && !document.querySelector('#autoConcepts').hidden).map(b => b.dataset.generate));
  expect(await visible()).toEqual([]);
  await setEvaluation(page, { utility: true });
  expect(await visible()).toEqual(['max-utility', 'min-utility']);
  await setEvaluation(page, { costs: true });
  expect(await visible()).toEqual(['max-utility', 'min-utility', 'min-cost', 'max-cost', 'best-value']);
});

test('Automatische Konzepte entsprechen der vollständigen Durchrechnung (nur verträgliche Kombinationen)', async ({ page }) => {
  await setEvaluation(page, { costs: true, utility: true });
  for (const key of ['max-utility', 'min-utility', 'min-cost', 'max-cost', 'best-value']) {
    await page.click(`[data-generate="${key}"]`);
  }
  const ref = bruteForce(await storedMatrix(page));
  const footer = await compareFooter(page);
  expect(footer[0]).toContain(euro(ref.minC));
  expect(footer[0]).toContain(euro(ref.maxC));
  expect(footer[1]).toContain(de(ref.maxU));
  expect(footer[1]).toContain(de(ref.minU));
  expect(footer[2]).toContain(euro(ref.bestRatio));
  // Bestes Preis-Leistungs-Verhältnis ist als bester Wert markiert
  await expect(page.locator('#compareTable tfoot tr').last().locator('td.best')).toHaveText(euro(ref.bestRatio));
});

test('Gleiche Kombination wird nicht doppelt angelegt; Rückgängig entfernt das Konzept', async ({ page }) => {
  await setEvaluation(page, { costs: true, utility: true });
  await page.click('[data-generate="best-value"]');
  await expect(page.locator('.concept')).toHaveCount(4);
  await page.click('[data-generate="best-value"]');
  await expect(page.locator('.concept')).toHaveCount(4);
  await expect(page.locator('#toast')).toContainText('gibt es bereits');
  await page.click('#undoBtn');
  await expect(page.locator('.concept')).toHaveCount(3);
});
