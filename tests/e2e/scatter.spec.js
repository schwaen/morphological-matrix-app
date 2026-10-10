import { test, expect, menu, setEvaluation } from './fixtures.js';

async function openLastenrad(page) {
  await menu(page, 'example');
  await page.locator('#exampleList .doc', { hasText: 'Lastenrad' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.locator('#title')).toHaveValue(/Lastenrad/);
}

const point = (page, name) => page.locator('.sc-pt').filter({ has: page.locator(`.sc-hit[aria-label^="${name}:"]`) });

test('Kosten/Nutzen: Punkte, Pareto-Front, unvollständige und übertroffene Konzepte, Tooltip', async ({ page }) => {
  await openLastenrad(page);
  await page.click('[data-compare-view="scatter"]');
  await expect(page.locator('#compareScatter .sc-pt')).toHaveCount(7);
  await expect(page.locator('#compareScatter .sc-front')).toHaveCount(1);
  await expect(page.locator('#compareScatter .sc-pt.is-hollow')).toHaveCount(2); // Gewerbe & Logistik, Entwurf
  await expect(point(page, 'Entwurf: Nachhaltig')).toHaveClass(/is-dominated/);
  await expect(point(page, 'Leichtbau')).not.toHaveClass(/is-dominated/);

  // Tooltip per Tastatur (und Maus): Kennzahlen und Begründung
  await point(page, 'Entwurf: Nachhaltig').locator('.sc-hit').focus();
  const tip = page.locator('.sc-tip');
  await expect(tip).toContainText('3.165,00 € *');
  await expect(tip).toContainText('zählt nicht zur Pareto-Front');
  await expect(tip).toContainText('Nach den bisherigen Werten übertroffen von „Leichtbau“');
  await point(page, 'Familie').locator('.sc-hit').hover();
  await expect(tip).toContainText('Auf der Pareto-Front');

  // Klick wählt das Konzept aus; die Ansicht bleibt nach dem Neuladen
  await point(page, 'Premium').locator('.sc-hit').click();
  await expect(page.locator('.concept.is-active .concept-name')).toHaveValue('Premium');
  await page.reload();
  await expect(page.locator('[data-compare-view="scatter"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Kosten/Nutzen nur mit Kosten und Nutzwert; sonst Tabelle', async ({ page }) => {
  await expect(page.locator('[data-compare-view="scatter"]')).toHaveCount(0);
  await setEvaluation(page, { costs: true, utility: true });
  await page.click('[data-compare-view="scatter"]');
  await expect(page.locator('#compareScatter')).toBeVisible();
  await setEvaluation(page, { costs: false });
  await expect(page.locator('[data-compare-view="scatter"]')).toHaveCount(0);
  await expect(page.locator('#compareTable')).toBeVisible();
  await expect(page.locator('[data-compare-view="table"]')).toHaveAttribute('aria-pressed', 'true');
});
