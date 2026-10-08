import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Model, Consistency, Evaluation, Ops, example: kaffeemaschine } = loadApp();

// Paare aus dem Kaffeemaschinen-Beispiel (IDs siehe examples/kaffeemaschine.js)
const PAIRS = [
  ['p1o4', 'p5o4', 'excluded'], ['p1o4', 'p5o3', 'excluded'], ['p1o1', 'p5o2', 'excluded'],
  ['p1o1', 'p5o4', 'excluded'], ['p2o3', 'p5o4', 'excluded'], ['p4o4', 'p5o4', 'excluded'],
  ['p4o3', 'p5o4', 'excluded'], ['p5o4', 'p6o2', 'excluded'], ['p2o1', 'p3o2', 'excluded'],
  ['p1o3', 'p5o2', 'conditional'], ['p3o4', 'p5o4', 'conditional'], ['p2o2', 'p5o3', 'conditional'],
];

/** Beispiel mit genau diesen Paaren (wie im Beispiel, aber unabhängig von dessen Pflege). */
function withPairs() {
  const m = kaffeemaschine();
  m.settings.costs = true;
  m.settings.utility = true;
  m.constraints = [];
  for (const [a, b, type] of PAIRS) Ops.setConstraint(m, a, b, type);
  return m;
}

/** Alle Kombinationen (je Parameter eine Ausprägung). */
function* combinations(m, i = 0, acc = []) {
  if (i === m.parameters.length) { yield acc; return; }
  for (const o of m.parameters[i].options) yield* combinations(m, i + 1, [...acc, o]);
}
const consistent = (m, os) => !m.constraints.some(c => c.type === 'excluded' && os.some(o => o.id === c.a) && os.some(o => o.id === c.b));

test('normalize: nur gültige Paare verschiedener Parameter, je Paar einmal, a < b', () => {
  const m = kaffeemaschine();
  m.constraints = [];
  const data = { ...plain(m), constraints: [
    { a: 'p5o4', b: 'p1o4', type: 'excluded', note: 'Strom' },
    { a: 'p1o4', b: 'p5o4', type: 'conditional' }, // Doppelt
    { a: 'p1o1', b: 'p1o2', type: 'excluded' }, // Gleicher Parameter
    { a: 'p1o1', b: 'gibtsnicht', type: 'excluded' },
    { a: 'p2o1', b: 'p3o2', type: 'vielleicht' },
    { a: 'p2o1', b: 'p3o2', type: 'conditional' },
  ] };
  assert.deepEqual(plain(Model.normalize(data).constraints), [
    { a: 'p1o4', b: 'p5o4', type: 'excluded', note: 'Strom' },
    { a: 'p2o1', b: 'p3o2', type: 'conditional', note: '' },
  ]);
  const v4 = { version: 4, parameters: [{ id: 'p', options: [{ id: 'o' }] }] };
  assert.deepEqual(plain(Model.normalize(v4).constraints), []);
});

test('setConstraint: setzen, ändern (Begründung bleibt), entfernen; Löschen räumt auf', () => {
  const m = kaffeemaschine();
  m.constraints = [];
  assert.equal(Ops.setConstraint(m, 'p5o4', 'p1o4', 'conditional'), true);
  assert.deepEqual(plain(m.constraints), [{ a: 'p1o4', b: 'p5o4', type: 'conditional', note: '' }]);
  m.constraints[0].note = 'Strom';
  assert.equal(Ops.setConstraint(m, 'p1o4', 'p5o4', 'excluded'), true);
  assert.equal(m.constraints[0].note, 'Strom');
  assert.equal(Ops.setConstraint(m, 'p1o4', 'p5o4', 'excluded'), false);
  assert.equal(Ops.setConstraint(m, 'p1o1', 'p1o2', 'excluded'), false, 'gleicher Parameter');
  assert.equal(Ops.setConstraint(m, 'p1o4', 'p5o4', null), true);
  assert.equal(m.constraints.length, 0);

  Ops.setConstraint(m, 'p1o4', 'p5o4', 'excluded');
  Ops.setConstraint(m, 'p2o1', 'p3o2', 'excluded');
  Ops.deleteOption(m, 'p5', 'p5o4');
  assert.deepEqual(plain(m.constraints.map(c => c.a)), ['p2o1']);
  Ops.deleteParameter(m, 'p3');
  assert.equal(m.constraints.length, 0);
});

test('Konflikte und Status je Konzept', () => {
  const m = withPairs();
  const outdoor = m.concepts.find(c => c.name === 'Outdoor');
  const { excluded, conditional } = Consistency.conflicts(m, outdoor);
  assert.deepEqual(plain(excluded.map(c => `${c.a}|${c.b}`)), ['p1o4|p5o4']);
  assert.equal(conditional.length, 0);
  const status = Consistency.statusFor(m, outdoor);
  assert.equal(status.get('p4o3').type, 'excluded'); // Touch-Display passt nicht zu Muskelkraft
  assert.equal(status.get('p3o4').type, 'conditional'); // Bohnen mit Mahlwerk nur bedingt
  assert.equal(status.has('p4o2'), false); // Tasten: verträglich
  assert.deepEqual(plain(Consistency.countFor(m, 'p5o4')), { excluded: 6, conditional: 1 });
  for (const c of m.concepts.filter(x => x !== outdoor)) assert.equal(Consistency.conflicts(m, c).excluded.length, 0);
});

test('countConsistent stimmt mit dem Durchzählen überein', () => {
  const m = withPairs();
  const brute = [...combinations(m)].filter(os => consistent(m, os)).length;
  assert.equal(brute, 1888);
  assert.equal(Consistency.countConsistent(m), 1888n);
  m.constraints = [];
  assert.equal(Consistency.countConsistent(m), 3072n);
  m.parameters[0].options = [];
  assert.equal(Consistency.countConsistent(m), 0n);
});

test('Automatische Konzepte meiden unverträgliche Paare und finden das Optimum', () => {
  const m = withPairs();
  const all = [...combinations(m)].filter(os => consistent(m, os));
  const utility = os => Evaluation.conceptUtility(m, { selections: Object.fromEntries(os.map((o, i) => [m.parameters[i].id, o.id])) }).value;
  const cost = os => os.reduce((s, o) => s + o.cost, 0);
  const sel = id => Evaluation.GENERATORS[id].build(m).selections;
  const asList = s => m.parameters.map(p => p.options.find(o => o.id === s[p.id]));

  // Ohne Paar hätte „Höchste Kosten“ Induktion + Gaskartusche gewählt (unverträglich)
  const maxCost = asList(sel('max-cost'));
  assert.ok(consistent(m, maxCost));
  assert.equal(cost(maxCost), Math.max(...all.map(cost)));
  const maxU = asList(sel('max-utility'));
  assert.ok(consistent(m, maxU));
  assert.ok(Math.abs(utility(maxU) - Math.max(...all.map(utility))) < 1e-9);
  const minCost = asList(sel('min-cost'));
  assert.equal(cost(minCost), Math.min(...all.map(cost)));
  const best = asList(sel('best-value'));
  assert.ok(consistent(m, best));
  const ratio = os => cost(os) / utility(os);
  assert.ok(Math.abs(ratio(best) - Math.min(...all.map(ratio))) < 1e-9);
});

test('Zufällige Konzepte sind verträglich', () => {
  const m = withPairs();
  let seed = 1;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 100; i++) {
    Ops.randomizeActive(m, random);
    const c = m.concepts.find(x => x.id === m.activeConceptId);
    assert.equal(Object.keys(c.selections).length, m.parameters.length);
    assert.equal(Consistency.conflicts(m, c).excluded.length, 0);
  }
});

test('countConsistent: zu aufwendige Zählung ergibt null statt einer falschen Zahl', () => {
  // Kette aus Parametern mit je drei Ausprägungen; jede Ausprägung ist mit allen übrigen
  // Ausprägungen späterer Parameter verknüpft – bei kleiner Grenze nicht mehr zählbar.
  const m = Model.normalize({
    version: Model.SCHEMA_VERSION,
    parameters: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, options: [0, 1, 2].map(j => ({ id: `p${i}o${j}` })) })),
  });
  for (let i = 0; i < 8; i++) for (let k = i + 1; k < 8; k++) Ops.setConstraint(m, `p${i}o0`, `p${k}o1`, 'excluded');
  assert.equal(Consistency.countConsistent(m, 3), null);
  const exact = Consistency.countConsistent(m);
  const brute = [...combinations(m)].filter(os => consistent(m, os)).length;
  assert.equal(exact, BigInt(brute));
});

test('countConsistent: zufällige Matrizen stimmen mit dem Durchzählen überein', () => {
  let seed = 42;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let run = 0; run < 150; run++) {
    const nP = 2 + Math.floor(rnd() * 5);
    const m = Model.normalize({
      version: Model.SCHEMA_VERSION,
      parameters: Array.from({ length: nP }, (_, i) => ({ id: `p${i}`, options: Array.from({ length: 1 + Math.floor(rnd() * 4) }, (_, j) => ({ id: `p${i}o${j}` })) })),
    });
    const all = m.parameters.flatMap(p => p.options.map(o => o.id));
    const pairs = Math.floor(rnd() * 10);
    for (let k = 0; k < pairs; k++) {
      Ops.setConstraint(m, all[Math.floor(rnd() * all.length)], all[Math.floor(rnd() * all.length)], rnd() < 0.8 ? 'excluded' : 'conditional');
    }
    const brute = [...combinations(m)].filter(os => consistent(m, os)).length;
    assert.equal(Consistency.countConsistent(m), BigInt(brute), `Lauf ${run}`);
  }
});

test('countConsistent: Zwischenspeicher rechnet nach Änderungen neu', () => {
  const m = withPairs();
  assert.equal(Consistency.countConsistent(m), 1888n);
  Ops.setConstraint(m, 'p1o4', 'p5o4', null);
  assert.equal(Consistency.countConsistent(m), 1932n);
  m.parameters[0].options[0].text = 'Anderer Text'; // Texte ändern die Anzahl nicht
  assert.equal(Consistency.countConsistent(m), 1932n);
  Ops.deleteOption(m, 'p1', 'p1o2');
  assert.equal(Consistency.countConsistent(m), BigInt([...combinations(m)].filter(os => consistent(m, os)).length));
});

/** Matrix aus Parametern p0…p(n-1) mit je `k` Ausprägungen p{i}o{j}, ohne Paare. */
const grid = (n, k) => Model.normalize({
  version: Model.SCHEMA_VERSION,
  parameters: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, options: Array.from({ length: k }, (_, j) => ({ id: `p${i}o${j}` })) })),
});

test('partners: Paare je Ausprägung in beide Richtungen', () => {
  const m = withPairs();
  const map = Consistency.partners(m);
  assert.deepEqual(plain(map.get('p1o4').map(x => x.other).sort()), ['p5o3', 'p5o4']);
  assert.equal(map.get('p5o4').length, 7);
  assert.equal(map.get('p1o3')[0].c.type, 'conditional');
  assert.equal(map.has('p1o2'), false);
});

test('statusFor: ohne Konzept leer; „unverträglich“ hat Vorrang vor „bedingt“', () => {
  const m = grid(3, 2);
  assert.equal(Consistency.statusFor(m, null).size, 0);
  const concept = { selections: { p0: 'p0o0', p1: 'p1o0' } };
  // p2o0 ist mit der einen Wahl bedingt, mit der anderen nicht verträglich – in beiden Reihenfolgen
  for (const order of [['conditional', 'excluded'], ['excluded', 'conditional']]) {
    m.constraints = [];
    Ops.setConstraint(m, 'p0o0', 'p2o0', order[0]);
    Ops.setConstraint(m, 'p1o0', 'p2o0', order[1]);
    const s = Consistency.statusFor(m, concept).get('p2o0');
    assert.equal(s.type, 'excluded');
    assert.equal(s.with, order[0] === 'excluded' ? 'p0o0' : 'p1o0');
  }
});

test('optimize: auch mit kleinem Budget eine verträgliche Lösung', () => {
  const m = withPairs();
  const all = [...combinations(m)].filter(os => consistent(m, os));
  const keyOf = (p, o) => [-o.cost];
  const full = Consistency.optimize(m, p => p.options, keyOf);
  const quick = Consistency.optimize(m, p => p.options, keyOf, 0);
  const cost = s => m.parameters.reduce((t, p) => t + p.options.find(o => o.id === s[p.id]).cost, 0);
  const asList = s => m.parameters.map(p => p.options.find(o => o.id === s[p.id]));
  assert.equal(cost(full.selections), Math.max(...all.map(os => os.reduce((t, o) => t + o.cost, 0))));
  assert.equal(quick.empty, 0);
  assert.ok(consistent(m, asList(quick.selections)));
  assert.ok(cost(quick.selections) <= cost(full.selections));
});

test('randomCombination: ohne verträgliche Lösung bleiben Parameter leer', () => {
  const m = grid(2, 1);
  Ops.setConstraint(m, 'p0o0', 'p1o0', 'excluded');
  assert.deepEqual(plain(Consistency.randomCombination(m, Math.random)), { p0: 'p0o0' });
});

test('randomCombination: bricht eine aussichtslose Suche ab und wählt der Reihe nach', () => {
  // Jede Ausprägung des letzten Parameters schließt jede des ersten aus: Die Suche müsste
  // 3¹⁰ Teillösungen prüfen und endet nach der Schrittgrenze im Rückfall.
  const m = grid(12, 3);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Ops.setConstraint(m, `p0o${i}`, `p11o${j}`, 'excluded');
  const sel = Consistency.randomCombination(m, () => 0.5);
  assert.equal(Object.keys(sel).length, 11);
  assert.equal(sel.p11, undefined);
  assert.equal(Consistency.conflicts(m, { selections: sel }).excluded.length, 0);
});
