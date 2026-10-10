import { test } from 'vitest';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Model, Evaluation, Ops, Texts, example: kaffeemaschine } = loadApp();

/** Beispielmatrix mit aktivierter Bewertung, ohne Verträglichkeiten. */
function example() {
  const m = kaffeemaschine();
  m.settings.costs = true;
  m.settings.utility = true;
  m.constraints = []; // Verträglichkeiten prüft tests/unit/consistency.test.js
  return m;
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

test('Kosten, Nutzwert und Preis-Leistung der Beispielkonzepte', () => {
  const m = example();
  const rows = m.concepts.map(c => [
    Evaluation.conceptCost(m, c).total,
    round(Evaluation.conceptUtility(m, c).value),
    round(Evaluation.priceValue(m, c).value),
  ]);
  assert.deepEqual(plain(rows), [[54, 7.25, 7.45], [57, 5.75, 9.91], [133, 7.58, 17.54]]);
});

test('Fehlende Werte werden gezählt; Preis-Leistung dann nicht berechenbar', () => {
  const m = example();
  const c = m.concepts[0];
  Model.selectedOption(m.parameters[0], c).cost = null;
  delete c.selections[m.parameters[1].id];
  // Kompakt-Espresso ohne Thermoblock-Kosten und ohne Druckerzeugung: 3 + 4 + 3 + 10
  assert.deepEqual(plain(Evaluation.conceptCost(m, c)), { total: 20, missing: 2 });
  assert.equal(Evaluation.conceptUtility(m, c).missing, 1);
  assert.equal(Evaluation.priceValue(m, c).value, null);
  assert.match(Evaluation.priceValue(m, c).reason, /unvollständig/);
});

test('Gewichte: Standard 1, Gewicht 0 zählt nicht als fehlend, Anteil', () => {
  const m = example();
  for (const p of m.parameters) p.weight = null;
  assert.equal(Evaluation.totalWeight(m), 6);
  assert.equal(round(Evaluation.weightShare(m, m.parameters[0]), 4), round(1 / 6, 4));
  m.parameters[0].weight = 0;
  delete m.concepts[0].selections[m.parameters[0].id];
  assert.equal(Evaluation.conceptUtility(m, m.concepts[0]).missing, 0);
  for (const p of m.parameters) p.weight = 0;
  assert.equal(Evaluation.weightShare(m, m.parameters[0]), null);
  assert.equal(Evaluation.conceptUtility(m, m.concepts[0]).value, null);
});

test('Nutzwerte werden auf die Skala begrenzt', () => {
  const m = example();
  m.settings.utilityMax = 5;
  assert.equal(Evaluation.clampScore(m, 9), 5);
  assert.equal(Evaluation.clampScore(m, -2), 0);
});

// ---------- Automatische Konzepte ----------

/** Alle Kombinationen durchrechnen (Referenz). */
function bruteForce(m) {
  const r = { minC: Infinity, maxC: -Infinity, minU: Infinity, maxU: -Infinity, bestRatio: Infinity };
  const rec = (i, sel) => {
    if (i === m.parameters.length) {
      const c = { selections: sel };
      const C = Evaluation.conceptCost(m, c).total;
      const U = Evaluation.conceptUtility(m, c).value;
      r.minC = Math.min(r.minC, C); r.maxC = Math.max(r.maxC, C);
      r.minU = Math.min(r.minU, U); r.maxU = Math.max(r.maxU, U);
      if (U > 0) r.bestRatio = Math.min(r.bestRatio, C / U);
      return;
    }
    for (const o of m.parameters[i].options) rec(i + 1, { ...sel, [m.parameters[i].id]: o.id });
  };
  rec(0, {});
  return r;
}

/** Wert eines erzeugten Konzepts. */
function evaluate(m, key) {
  const { selections, error } = Evaluation.GENERATORS[key].build(m);
  assert.equal(error, undefined, `${key}: ${error}`);
  const c = { selections };
  return { C: Evaluation.conceptCost(m, c).total, U: Evaluation.conceptUtility(m, c).value };
}

/** Kleiner deterministischer Zufallsgenerator (Mulberry32) für reproduzierbare Tests. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomMatrix(rand) {
  const m = Model.blankState();
  m.settings.costs = true;
  m.settings.utility = true;
  m.parameters = Array.from({ length: 2 + Math.floor(rand() * 4) }, (_, i) => ({
    id: `p${i}`, name: `P${i}`, categoryId: null,
    weight: rand() < 0.3 ? null : Math.round(rand() * 5),
    options: Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, j) => ({
      id: `p${i}o${j}`, text: `O${j}`,
      cost: Math.round(rand() * 100), scores: { nw: Math.round(rand() * 10) },
    })),
  }));
  return m;
}

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('Generatoren treffen auf das Beispiel die Optima der vollständigen Durchrechnung', () => {
  const m = example();
  const ref = bruteForce(m);
  assert.equal(evaluate(m, 'min-cost').C, ref.minC);
  assert.equal(evaluate(m, 'max-cost').C, ref.maxC);
  assert.ok(close(evaluate(m, 'max-utility').U, ref.maxU));
  assert.ok(close(evaluate(m, 'min-utility').U, ref.minU));
  const best = evaluate(m, 'best-value');
  assert.ok(close(best.C / best.U, ref.bestRatio));
});

test('Beste Preis-Leistung ist auf 300 Zufallsmatrizen optimal (Dinkelbach vs. Durchrechnung)', () => {
  const rand = rng(42);
  let checked = 0;
  for (let n = 0; n < 300; n++) {
    const m = randomMatrix(rand);
    const ref = bruteForce(m);
    const res = Evaluation.GENERATORS['best-value'].build(m);
    if (res.error) {
      // Nur erlaubt, wenn wirklich kein Konzept mit Nutzwert > 0 existiert bzw. alle Gewichte 0 sind
      assert.ok(ref.bestRatio === Infinity || Evaluation.totalWeight(m) === 0, res.error);
      continue;
    }
    const c = { selections: res.selections };
    const ratio = Evaluation.conceptCost(m, c).total / Evaluation.conceptUtility(m, c).value;
    assert.ok(close(ratio, ref.bestRatio), `Matrix ${n}: ${ratio} statt ${ref.bestRatio}`);
    checked++;
  }
  assert.ok(checked > 200);
});

test('Gleichstand: höchster Nutzwert wählt die günstigere Ausprägung', () => {
  const m = example();
  const p = m.parameters[0];
  p.options[0].scores.nw = 9; p.options[0].cost = 50;
  p.options[3].scores.nw = 9; p.options[3].cost = 40;
  const { selections } = Evaluation.GENERATORS['max-utility'].build(m);
  assert.equal(selections[p.id], p.options[3].id);
});

test('Fehlende Werte: Parameter wird übersprungen bzw. Fehlermeldung', () => {
  const m = example();
  for (const o of m.parameters[0].options) o.cost = null;
  const res = Evaluation.GENERATORS['min-cost'].build(m);
  assert.equal(res.skipped, 1);
  assert.equal(res.selections[m.parameters[0].id], undefined);
  assert.match(Evaluation.GENERATORS['best-value'].build(m).error, /in jedem Parameter/);
});

test('Verfügbarkeit hängt von den Einstellungen ab', () => {
  const m = kaffeemaschine();
  const avail = () => Object.keys(Evaluation.GENERATORS).filter(k => Evaluation.GENERATORS[k].available(m));
  assert.deepEqual(plain(avail()), []);
  m.settings.utility = true;
  assert.deepEqual(plain(avail()), ['max-utility', 'min-utility']);
  m.settings.costs = true;
  assert.deepEqual(plain(avail()), ['max-utility', 'min-utility', 'min-cost', 'max-cost', 'best-value']);
  m.settings.moscow = true;
  assert.deepEqual(plain(avail()).slice(-3), ['moscow-must', 'moscow-should', 'moscow-could']);
});

/** Ausprägungstexte eines erzeugten Konzepts (leer = nicht gewählt). */
const texts = (m, selections) => m.parameters.map(p => (p.options.find(o => o.id === selections[p.id]) || { text: '' }).text);

test('MoSCoW-Pfade: nur genau die Priorität, Parameter ohne Treffer bleiben leer', () => {
  const m = kaffeemaschine();
  m.settings.moscow = true;
  const must = Evaluation.GENERATORS['moscow-must'].build(m);
  assert.deepEqual(plain(texts(m, must.selections)),
    ['Durchlauferhitzer', 'Vibrationspumpe', 'Pulver (lose)', 'Drehknopf', 'Netzstrom', 'Manuell']);
  assert.equal(must.skipped, 0);
  // Druckerzeugung und Energieversorgung haben kein Should → leer, kein Rückfall auf Must
  const should = Evaluation.GENERATORS['moscow-should'].build(m);
  assert.deepEqual(plain(texts(m, should.selections)),
    ['Thermoblock', '', 'Pad', 'Tasten', '', 'Automatische Spülung']);
  assert.equal(should.skipped, 2);
  const could = Evaluation.GENERATORS['moscow-could'].build(m);
  assert.deepEqual(plain(texts(m, could.selections)),
    ['Induktion', 'Rotationspumpe', 'Bohnen mit Mahlwerk', 'Touch-Display', 'Akku', '']);
  assert.equal(could.skipped, 1);
});

test('MoSCoW-Pfade: Gleichstand – MVP günstigste, Standard/Premium höchster Nutzwert', () => {
  const m = kaffeemaschine();
  Object.assign(m.settings, { moscow: true, costs: true, utility: true });
  const p = m.parameters[0];
  p.options.forEach(o => { o.priority = null; });
  p.options[0].priority = 'must'; p.options[0].cost = 30; p.options[0].scores.nw = 9;
  p.options[1].priority = 'must'; p.options[1].cost = 10; p.options[1].scores.nw = 2;
  assert.equal(Evaluation.GENERATORS['moscow-must'].build(m).selections[p.id], p.options[1].id);
  p.options[0].priority = 'should'; p.options[1].priority = 'should';
  assert.equal(Evaluation.GENERATORS['moscow-should'].build(m).selections[p.id], p.options[0].id);
});

test('Prioritätsprofil zählt die gewählten Ausprägungen je Priorität', () => {
  const m = kaffeemaschine();
  const outdoor = m.concepts.find(c => c.name === 'Outdoor');
  assert.deepEqual(plain(Evaluation.priorityProfile(m, outdoor)), { must: 2, should: 1, could: 1, wont: 2, none: 0 });
  delete outdoor.selections[m.parameters[0].id];
  m.parameters[1].options.forEach(o => { o.priority = null; });
  assert.deepEqual(plain(Evaluation.priorityProfile(m, outdoor)), { must: 2, should: 1, could: 0, wont: 1, none: 1 });
});

test('Kennzahlenbericht: alle Werte einmal berechnet, beste Werte markiert', () => {
  const m = kaffeemaschine();
  Object.assign(m.settings, { costs: true, utility: true, moscow: true });
  const rows = Evaluation.conceptReport(m);
  const by = name => rows.find(r => r.concept.name === name);
  assert.equal(rows.length, 3);
  assert.equal(by('Kompakt-Espresso').cost.total, 54);
  assert.deepEqual(plain(rows.filter(r => r.cost.best).map(r => r.concept.name)), ['Kompakt-Espresso']);
  assert.deepEqual(plain(rows.filter(r => r.utility.best).map(r => r.concept.name)), ['Smart Home']);
  assert.deepEqual(plain(rows.filter(r => r.priceValue.best).map(r => r.concept.name)), ['Kompakt-Espresso']);
  assert.deepEqual(plain(by('Outdoor').priority), { must: 2, should: 1, could: 1, wont: 2, none: 0 });
  // Gleiche Werte wie die Einzelfunktionen
  for (const r of rows) {
    assert.equal(r.cost.total, Evaluation.conceptCost(m, r.concept).total);
    assert.equal(r.utility.value, Evaluation.conceptUtility(m, r.concept).value);
    assert.equal(r.priceValue.value, Evaluation.priceValue(m, r.concept).value);
  }
});

test('Kennzahlenbericht: nur aktive Bewertungen; bester Wert erst ab zwei vergleichbaren Konzepten', () => {
  const m = kaffeemaschine();
  const off = Evaluation.conceptReport(m)[0];
  assert.deepEqual([off.cost, off.utility, off.priceValue, off.priority], [null, null, null, null]);

  m.settings.costs = true;
  // Unvollständige Kosten zählen nie als bester Wert, auch wenn sie am niedrigsten sind
  m.parameters[0].options.forEach(o => { o.cost = null; });
  const rows = Evaluation.conceptReport(m);
  assert.ok(rows.every(r => r.cost.missing === 1 && !r.cost.best));
  m.concepts = [m.concepts[0]];
  assert.equal(Evaluation.conceptReport(m)[0].cost.best, false);
});

test('Kennzahlenbericht: Gleichstand markiert alle Bestwerte', () => {
  const m = kaffeemaschine();
  m.settings.costs = true;
  m.concepts.push({ ...m.concepts[0], id: 'kopie', name: 'Kopie' });
  const best = Evaluation.conceptReport(m).filter(r => r.cost.best).map(r => r.concept.name);
  assert.deepEqual(plain(best), ['Kompakt-Espresso', 'Kopie']);
});

test('rankConcepts: Sortierung nach Nutzwert, Kosten und Preis-Leistung', () => {
  const m = example();
  const order = key => Evaluation.rankConcepts(m, Evaluation.conceptReport(m), key)
    .map(x => [x.figures.concept.id, x.rank]);
  assert.deepEqual(plain(order('utility')), [['c3', 1], ['c1', 2], ['c2', 3]]);
  assert.deepEqual(plain(order('cost')), [['c1', 1], ['c2', 2], ['c3', 3]]);
  assert.deepEqual(plain(order('priceValue')), [['c1', 1], ['c2', 2], ['c3', 3]]);
  assert.deepEqual(plain(order('order')), [['c1', null], ['c2', null], ['c3', null]]);
});

test('rankConcepts: Unvollständige zuletzt, Gleichstand teilt den Rang, inaktive Bewertung ohne Rang', () => {
  const m = example();
  Model.selectedOption(m.parameters[0], m.concepts[0]).cost = null; // c1 unvollständig
  m.concepts[2].selections = { ...m.concepts[1].selections }; // c3 = c2
  const ranked = Evaluation.rankConcepts(m, Evaluation.conceptReport(m), 'cost').map(x => [x.figures.concept.id, x.rank]);
  assert.deepEqual(plain(ranked), [['c2', 1], ['c3', 1], ['c1', null]]);
  m.settings.costs = false;
  assert.ok(Evaluation.rankConcepts(m, Evaluation.conceptReport(m), 'cost').every(x => x.rank == null));
});

test('Beste Preis-Leistung: Fehlerfälle', () => {
  const build = m => Evaluation.GENERATORS['best-value'].build(m);
  const E = Texts.evaluation;
  // Ohne Parameter
  const empty = example();
  empty.parameters = [];
  assert.equal(build(empty).error, E.needsAllValues);
  // Alle Gewichte 0
  const noWeight = example();
  for (const p of noWeight.parameters) p.weight = 0;
  assert.equal(build(noWeight).error, E.zeroWeights);
  // Alle Nutzwerte 0
  const noScore = example();
  for (const p of noScore.parameters) for (const o of p.options) o.scores.nw = 0;
  assert.equal(build(noScore).error, E.allScoresZero);
});

test('Preis-Leistung eines Konzepts mit Nutzwert 0 ist nicht berechenbar', () => {
  const m = example();
  const c = m.concepts[0];
  for (const p of m.parameters) for (const o of p.options) o.scores.nw = 0;
  assert.deepEqual(plain(Evaluation.priceValue(m, c)), { value: null, reason: Texts.evaluation.zeroUtility });
});

test('Beste Preis-Leistung: Parameter ohne verträgliche Ausprägung bleibt leer', () => {
  const m = example();
  // Die einzige verbleibende Ausprägung des ersten Parameters schließt jede des zweiten aus
  const [p1, p2] = m.parameters;
  p1.options = p1.options.slice(0, 1);
  for (const o of p2.options) Ops.setConstraint(m, p1.options[0].id, o.id, 'excluded');
  const res = Evaluation.GENERATORS['best-value'].build(m);
  assert.equal(res.skipped, 1);
  assert.equal(Object.keys(res.selections).length, m.parameters.length - 1);
  assert.equal(res.selections[p1.id] && res.selections[p2.id], undefined);
});

test('Pareto-Front: übertroffene, gleichwertige und unvollständig bewertete Konzepte', () => {
  // Kennzahlen wie im Beispiel Lastenrad (missing > 0 = unvollständig)
  const row = (id, cost, utility, missing = 0) => ({
    concept: { id, name: id }, cost: { total: cost, missing, best: false }, utility: { value: utility, missing: 0, best: false },
  });
  const report = [
    row('budget', 1365, 4.54), row('familie', 3645, 7.43), row('premium', 6555, 8.63), row('gewerbe', 5845, 7.89, 2),
    row('sharing', 3275, 6.91), row('leicht', 2950, 5.54), row('entwurf', 3165, 5.17, 1),
    row('teuer', 7000, 7.43), row('zwilling', 3645, 7.43), // übertroffen bzw. gleichwertig
    { concept: { id: 'ohne', name: 'ohne' }, cost: { total: 0, missing: 6, best: false }, utility: { value: null, missing: 6, best: false } },
  ];
  const p = Evaluation.pareto(report);
  const front = [...p].filter(([, v]) => v.front).map(([id]) => id);
  assert.deepEqual(front, ['budget', 'familie', 'premium', 'sharing', 'leicht', 'zwilling']);
  // Unvollständig: nie auf der Front, auch wenn nach bisherigen Werten nicht übertroffen
  assert.equal(p.get('gewerbe').front, false);
  assert.equal(p.get('gewerbe').dominatedBy, null);
  assert.equal(p.get('entwurf').dominatedBy.id, 'leicht');
  // Mehrere übertreffen: das mit dem höchsten Nutzwert, bei Gleichstand das günstigere
  assert.equal(p.get('teuer').dominatedBy.id, 'premium');
  assert.equal(p.has('ohne'), false); // ohne Nutzwert nicht darstellbar
});

/** Beispiel mit vier Kriterien (Geschmack 35, Komfort 25, Nachhaltigkeit 20, Wartung 20). */
function withCriteria() {
  const m = example();
  m.settings.criteria = [
    { id: 'g', name: 'Geschmack', weight: 35 }, { id: 'k', name: 'Komfort', weight: 25 },
    { id: 'n', name: 'Nachhaltigkeit', weight: 20 }, { id: 'w', name: 'Wartung', weight: 20 },
  ];
  const values = [[6, 8, 6, 7], [7, 5, 4, 5], [8, 8, 7, 7], [9, 9, 6, 6]];
  for (const p of m.parameters) {
    p.options.forEach((o, i) => { const v = values[i % values.length]; o.scores = { g: v[0], k: v[1], n: v[2], w: v[3] }; });
  }
  return m;
}

test('Kriterien: Nutzwert einer Ausprägung ist das gewichtete Mittel; teilweise bewertet zählt fehlend als 0', () => {
  const m = withCriteria();
  const o = m.parameters[0].options[2]; // 8, 8, 7, 7
  assert.equal(round(Evaluation.optionScore(m, o).value), 7.6);
  assert.equal(Evaluation.optionScore(m, o).complete, true);
  o.scores = { g: 7, w: 5 };
  assert.deepEqual(plain({ ...Evaluation.optionScore(m, o), value: round(Evaluation.optionScore(m, o).value) }), { value: 3.45, rated: 2, total: 4, complete: false });
  o.scores = {};
  assert.equal(Evaluation.optionScore(m, o).value, null);
  // Kriterium mit Gewicht 0 muss nicht bewertet sein
  m.settings.criteria[3].weight = 0;
  o.scores = { g: 7, k: 5, n: 4 };
  assert.equal(Evaluation.optionScore(m, o).complete, true);
  // Alle Gewichte 0: alle Kriterien zählen gleich
  m.settings.criteria.forEach(c => { c.weight = 0; });
  assert.deepEqual(plain(Evaluation.criterionShares(m).map(x => x.share)), [0.25, 0.25, 0.25, 0.25]);
});

test('Kriterien: Gesamtnutzwert = gewichtete Summe der Werte je Kriterium; Generatoren bleiben exakt', () => {
  const m = withCriteria();
  for (const c of m.concepts) {
    const total = Evaluation.conceptUtility(m, c).value;
    const parts = Evaluation.conceptCriteria(m, c);
    assert.equal(round(parts.reduce((s, x) => s + x.share * x.value, 0), 9), round(total, 9));
  }
  // „Höchster Nutzwert“ wählt je Parameter die Ausprägung mit dem höchsten gewichteten Mittel
  const r = Evaluation.GENERATORS['max-utility'].build({ ...m, constraints: [] });
  for (const p of m.parameters) {
    const best = Math.max(...p.options.map(o => Evaluation.scoreOf(m, o)));
    const chosen = p.options.find(o => o.id === r.selections[p.id]);
    assert.equal(Evaluation.scoreOf(m, chosen), best, p.name);
  }
});
