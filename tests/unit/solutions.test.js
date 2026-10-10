import { test } from 'vitest';
import assert from 'node:assert/strict';
import { loadApp } from './load.js';
import { Solutions } from '../../js/solutions.js';

const { Consistency, Evaluation, Attributes, example } = loadApp();

/** Beispiel mit Kosten und Nutzwert. */
function matrix() {
  const m = example();
  m.settings.costs = true;
  m.settings.utility = true;
  return m;
}

/** @returns {import('../../js/solutions.js').SolutionQuery} */
const query = (over = {}) => ({ fixed: {}, limits: false, strict: false, maxCost: null, minUtility: null, sort: 'order', limit: 50, ...over });

/** Alle Kombinationen per Brute Force, mit denselben Filtern (Vergleichsrechnung). */
function brute(m, q) {
  const out = [];
  const P = m.parameters;
  const rec = (i, sel) => {
    if (i === P.length) {
      const c = { id: 'x', selections: { ...sel } };
      const { excluded, conditional } = Consistency.conflicts(m, c);
      if (excluded.length || (q.strict && conditional.length)) return;
      const cost = Evaluation.conceptCost(m, c);
      const util = Evaluation.conceptUtility(m, c);
      if (q.maxCost != null && cost.total > q.maxCost) return;
      if (q.minUtility != null && (util.value ?? 0) < q.minUtility) return;
      if (q.limits && m.settings.attributes.some(a => Attributes.summarize(m, a, c).warn)) return;
      out.push({ sel: { ...sel }, cost, util, pv: Evaluation.priceValue(m, c).value, c });
      return;
    }
    const opts = q.fixed[P[i].id] ? P[i].options.filter(o => o.id === q.fixed[P[i].id]) : P[i].options;
    for (const o of opts) { sel[P[i].id] = o.id; rec(i + 1, sel); }
  };
  rec(0, {});
  return out;
}

const close = (a, b) => (a == null ? b == null : Math.abs(a - b) < 1e-9);

test('Ohne Filter: alle widerspruchsfreien Kombinationen in Matrix-Reihenfolge', () => {
  const m = matrix();
  const r = Solutions.search(m, query());
  const all = brute(m, query());
  assert.equal(r.matched, all.length);
  assert.equal(r.matched, 1888);
  assert.equal(r.rows.length, 50);
  assert.deepEqual(r.rows.map(x => x.selections), all.slice(0, 50).map(x => x.sel));
  const first = all[0];
  assert.ok(close(r.rows[0].cost, first.cost.total));
  assert.ok(close(r.rows[0].utility, first.util.value));
});

test('Festlegung, Kosten- und Nutzwertfilter, nur voll verträgliche', () => {
  const m = matrix();
  const q = query({ fixed: { p5: 'p5o1' }, maxCost: 100, minUtility: 7, strict: true });
  const r = Solutions.search(m, q);
  assert.equal(r.matched, brute(m, q).length);
  assert.ok(r.matched > 0);
  assert.ok(r.rows.every(x => x.selections.p5 === 'p5o1' && x.cost <= 100 && x.utility >= 7));
});

test('Grenzen der Merkmale: entspricht der Warnung im Vergleich', () => {
  const m = matrix();
  // Zusätzlich Mittelwert und Stufen-Grenze, damit alle Prüfwege laufen
  m.settings.attributes.push(
    { id: 'r', name: 'Reife', description: '', source: '', type: 'choice', unit: '', decimals: 0, levels: [{ id: 'l1', name: 'A' }, { id: 'l2', name: 'B' }], aggregate: 'max', limit: { op: 'level', value: 'l2' } },
    { id: 'j', name: 'Ja', description: '', source: '', type: 'bool', unit: '', decimals: 0, levels: [], aggregate: 'count', limit: { op: 'allYes' } },
  );
  m.parameters[3].options[2].values.r = 'l2';
  m.parameters[5].options.forEach((o, k) => { o.values.j = k !== 0; });
  for (const limits of [false, true]) {
    const q = query({ limits });
    assert.equal(Solutions.search(m, q).matched, brute(m, q).length, `limits=${limits}`);
  }
  m.settings.attributes[1].aggregate = 'avg';
  const q = query({ limits: true });
  assert.equal(Solutions.search(m, q).matched, brute(m, q).length, 'Mittelwert');
});

for (const sort of ['utility', 'cost', 'priceValue', 'attr:gew:asc', 'attr:gew:desc', 'attr:db:asc']) {
  test(`Sortierung „${sort}“: vollständig und per Branch & Bound dieselben besten Treffer`, () => {
    const m = matrix();
    const q = query({ sort, limit: 25 });
    const full = Solutions.search(m, q);
    const bb = Solutions.search(m, q, { fullLimit: 10 });
    assert.equal(bb.exhaustive, false);
    assert.equal(bb.complete, true);
    assert.equal(bb.matched, null);
    const key = { utility: r => r.utility, cost: r => (r.costMissing ? null : r.cost), priceValue: r => r.priceValue };
    const att = sort.startsWith('attr:') ? sort.split(':') : null;
    const val = att
      ? r => Attributes.summarize(m, m.settings.attributes.find(a => a.id === att[1]), { selections: r.selections }).sort
      : key[sort];
    // Gleiche Werte in gleicher Reihenfolge (bei Gleichstand: Matrix-Reihenfolge)
    assert.deepEqual(bb.rows.map(val), full.rows.map(val));
    assert.deepEqual(bb.rows.map(r => r.selections), full.rows.map(r => r.selections));
    // Sortiert in der gewünschten Richtung
    const desc = sort === 'utility' || sort.endsWith(':desc');
    const vs = full.rows.map(val).filter(v => v != null);
    assert.deepEqual(vs, [...vs].sort((a, b) => (desc ? b - a : a - b)));
  });
}

test('Branch & Bound mit Filtern und Festlegung: dieselben Treffer wie vollständig', () => {
  const m = matrix();
  for (const sort of ['utility', 'priceValue', 'order', 'attr:gew:asc']) {
    const q = query({ sort, limit: 20, limits: true, maxCost: 120, minUtility: 6, fixed: { p5: 'p5o1' } });
    const full = Solutions.search(m, q);
    const bb = Solutions.search(m, q, { fullLimit: 10 });
    assert.equal(bb.complete, true, sort);
    assert.deepEqual(bb.rows.map(r => r.selections), full.rows.map(r => r.selections), sort);
  }
});

test('Budget erschöpft: Ergebnis als unvollständig markiert', () => {
  const r = Solutions.search(matrix(), query({ sort: 'priceValue' }), { fullLimit: 10, budget: 50 });
  assert.equal(r.complete, false);
});

test('Leere Matrix bzw. Parameter ohne Ausprägung', () => {
  const m = matrix();
  m.parameters[0].options = [];
  assert.deepEqual(Solutions.search(m, query()), { rows: [], matched: 0, exhaustive: true, complete: true });
});
