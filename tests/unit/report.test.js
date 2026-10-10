import { test } from 'vitest';
import assert from 'node:assert/strict';
import { loadApp } from './load.js';

const { Report, Model, example } = loadApp();
const date = new Date(2026, 9, 10);

/** Beispiel „Kaffeemaschine“ mit aktivierter Bewertung (Favorit, verworfenes Konzept, Verträglichkeiten). */
function withEvaluation() {
  const m = example();
  m.settings.costs = true;
  m.settings.utility = true;
  return m;
}

/** Position eines Textes im Bericht (zum Prüfen der Reihenfolge). */
const at = (s, part) => { const i = s.indexOf(part); assert.ok(i >= 0, `fehlt: ${part}`); return i; };

test('HTML-Bericht: Kopf, Reihenfolge der Abschnitte, Konzepte mit Status, Kennzahlen und Diagramm', () => {
  const html = Report.toHtml(withEvaluation(), Report.defaultParts(), { date });
  assert.match(html, /^<!doctype html><html lang="de">/);
  assert.match(html, /<h1>Beispiel: Kaffeemaschine<\/h1>/);
  assert.match(html, /Bericht vom 10\. Oktober 2026/);
  assert.match(html, /3\.072 Kombinationen, davon 1\.888 widerspruchsfrei/);
  assert.match(html, /3 Konzepte: 1 Favorit, 1 verworfen/);
  // Ergebnisse vor der Matrix
  const order = ['Lösungskonzepte', 'Konzeptvergleich', 'Kosten und Nutzwert', 'Morphologische Matrix', 'Verträglichkeiten'].map(h => at(html, `<h2>${h}</h2>`));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.match(html, /<span class="chip favorite">★ Favorit<\/span>/);
  assert.match(html, /class="concept dropped"/);
  assert.match(html, /Gesamtkosten <b>54,00\s€<\/b>/);
  assert.match(html, /⚠ 1 Konflikt: Induktion × Muskelkraft/);
  assert.match(html, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*role="img"/);
  assert.match(html, /Muskelkraft verträgt sich nicht/); // Grund zum Status
  assert.match(html, /Heizt in ca\. 30 s auf/); // Notiz einer Ausprägung
  assert.match(html, /Erstellt mit der App „Morphologische Matrix“ · Datenformat 7/);
});

test('HTML-Bericht: Teile abwählbar, verworfene Konzepte weglassen, Inhalte maskiert', () => {
  const m = withEvaluation();
  m.title = 'A <b>&</b> "B"';
  const parts = { ...Report.defaultParts(), hideDropped: true, chart: false, matrix: false, constraints: false, evaluation: false };
  const html = Report.toHtml(m, parts, { date });
  assert.match(html, /<h1>A &lt;b&gt;&amp;&lt;\/b&gt; &quot;B&quot;<\/h1>/);
  assert.doesNotMatch(html, /<h2>Morphologische Matrix<\/h2>|<h2>Verträglichkeiten<\/h2>|<svg/);
  assert.doesNotMatch(html, /Gesamtkosten/);
  assert.doesNotMatch(html, /<span class="name">Outdoor<\/span>/);
  assert.match(html, /1 verworfenes Konzept nicht aufgeführt\./);
  // Ohne Kosten und Nutzwert kein Diagramm, auch wenn gewählt
  assert.doesNotMatch(Report.toHtml(example(), Report.defaultParts(), { date }), /<svg/);
});

test('Markdown-Bericht: Überschriften, Tabellen, Notizen und maskierte Sonderzeichen', () => {
  const m = withEvaluation();
  m.concepts[2].note = 'Teuer | aber *gut*';
  const md = Report.toMarkdown(m, Report.defaultParts(), { date });
  assert.match(md, /^# Beispiel: Kaffeemaschine\n\n_Bericht vom 10\. Oktober 2026/);
  assert.match(md, /^### Kompakt-Espresso – ★ Favorit$/m);
  assert.match(md, /^### ~~Outdoor~~ – ⊘ Verworfen$/m);
  assert.match(md, /^Teuer \\\| aber \\\*gut\\\*$/m);
  assert.match(md, /^\| Parameter \| Kompakt-Espresso \| Outdoor \| Smart Home \|$/m);
  assert.match(md, /^\| Gesamtkosten \| \*\*54,00\s€\*\* \| 57,00\s€ \| 133,00\s€ \|$/m);
  assert.match(md, /^\| Brühsystem › Wassererwärmung \| Durchlauferhitzer \(18,00\s€ · NW 6\) \|/m);
  assert.match(md, /^- \*\*Thermoblock\*\* \(Wassererwärmung\): Heizt in ca\. 30 s auf/m);
  assert.match(md, /^\| Induktion \(Wassererwärmung\) \| Muskelkraft \(Energieversorgung\) \| ✕ Unverträglich \|/m);
  assert.doesNotMatch(md, /<svg/);
  // Jede Tabellenzeile hat gleich viele Spalten wie ihr Kopf
  for (const block of md.split('\n\n').filter(b => b.startsWith('| '))) {
    const cols = block.split('\n').map(l => l.replace(/\\\|/g, '').split('|').length);
    assert.ok(cols.every(n => n === cols[0]), block.slice(0, 60));
  }
});

test('Bericht einer leeren Matrix', () => {
  const m = Model.blankState();
  m.concepts = [];
  assert.match(Report.toHtml(m, Report.defaultParts(), { date }), /Noch keine Konzepte\./);
  assert.match(Report.toMarkdown(m, Report.defaultParts(), { date }), /Noch keine Konzepte\./);
});

test('Vorgabe des Export-Dialogs entspricht Report.defaultParts', async () => {
  const src = (await import('node:fs')).readFileSync('js/ui/export.jsx', 'utf8');
  const m = src.match(/const DEFAULT_PARTS = \{([^}]*)\}/);
  const parsed = Object.fromEntries(m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => s.split(':').map(x => x.trim())).map(([k, v]) => [k, v === 'true']));
  assert.deepEqual(parsed, Report.defaultParts());
});
