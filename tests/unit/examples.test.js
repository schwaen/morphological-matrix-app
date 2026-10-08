import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadApp, plain, EXAMPLE_FILES } from './load.js';

const { Model, Examples, Consistency, Evaluation } = loadApp();

/** Notizen und Verträglichkeiten sind in Dateien optional (fehlend = leer); für den Vergleich mit `normalize` ergänzen. */
function withEmptyNotes(data) {
  const d = plain(data);
  const fill = x => { if (x.note === undefined) x.note = ''; };
  d.parameters.forEach(p => { fill(p); p.options.forEach(fill); });
  d.concepts.forEach(fill);
  if (d.constraints === undefined) d.constraints = [];
  return d;
}

test('Jede eingebundene Beispiel-Datei meldet genau ein Beispiel an', () => {
  assert.ok(EXAMPLE_FILES.length > 0, 'mindestens ein Beispiel in index.html eingebunden');
  assert.deepEqual(plain(Examples.all().map(e => e.id)), EXAMPLE_FILES.map(f => path.basename(f, '.js')),
    'id entspricht dem Dateinamen, Reihenfolge wie in index.html');
});

for (const ex of Examples.all()) {
  test(`Beispiel „${ex.id}“ ist vollständig und im aktuellen Datenformat`, () => {
    assert.ok(ex.name && typeof ex.name === 'string', 'name fehlt');
    assert.equal(ex.data.version, Model.SCHEMA_VERSION, 'version');
    // Die Prüfung darf nichts ergänzen, verwerfen oder umbenennen – sonst ist die Datei fehlerhaft
    // (z. B. Konzeptauswahl verweist auf eine nicht vorhandene Ausprägung, doppelte IDs).
    assert.deepEqual(plain(Model.normalize(plain(ex.data))), withEmptyNotes(ex.data));
    assert.ok(ex.data.title, 'Titel fehlt');
    assert.ok(ex.data.parameters.length > 0, 'keine Parameter');
  });
}

test('Laden ergibt jeweils eine eigene Kopie', () => {
  const a = Examples.load('kaffeemaschine');
  const b = Examples.load('kaffeemaschine');
  a.title = 'geändert';
  a.parameters[0].options.pop();
  assert.equal(b.title, 'Beispiel: Kaffeemaschine');
  assert.equal(Examples.load('kaffeemaschine').parameters[0].options.length, b.parameters[0].options.length);
  assert.equal(Examples.load('gibt-es-nicht'), null);
});

test('Doppelte oder unvollständige Beispiele werden ignoriert', () => {
  const app = loadApp();
  const before = app.Examples.all().length;
  const warn = console.warn;
  console.warn = () => {};
  try {
    app.Examples.register({ id: 'kaffeemaschine', name: 'Doppelt', data: { parameters: [] } });
    app.Examples.register({ name: 'Ohne id', data: { parameters: [] } });
    app.Examples.register({ id: 'ohne-daten', name: 'Ohne Daten' });
  } finally {
    console.warn = warn;
  }
  assert.equal(app.Examples.all().length, before);
  assert.equal(app.Examples.get('kaffeemaschine').name, 'Kaffeemaschine');
});

test('Food-Truck: automatische Konzepte und MoSCoW-Pfade sind verträglich, das Stammtisch-Konzept nicht', () => {
  const m = Examples.load('food-truck');
  assert.equal(m.settings.moscow, true);
  for (const [id, gen] of Object.entries(Evaluation.GENERATORS)) {
    const res = gen.build(m);
    assert.ok(!res.error, `${id}: ${res.error}`);
    assert.equal(Consistency.conflicts(m, { selections: res.selections }).excluded.length, 0, id);
  }
  const byName = name => m.concepts.find(c => c.name === name);
  assert.equal(Consistency.conflicts(m, byName('Idee vom Stammtisch')).excluded.length, 4);
  for (const c of m.concepts.filter(x => x.name !== 'Idee vom Stammtisch')) {
    assert.equal(Consistency.conflicts(m, c).excluded.length, 0, c.name);
  }
  assert.equal(Consistency.countConsistent(m), 10_160_640n);
});

test('Krimi: alle Konzepte ohne Logikfehler, Zufall bleibt widerspruchsfrei', () => {
  const m = Examples.load('krimi');
  assert.equal(m.settings.costs || m.settings.utility || m.settings.moscow, false);
  for (const c of m.concepts) assert.equal(Consistency.conflicts(m, c).excluded.length, 0, c.name);
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 200; i++) {
    const selections = Consistency.randomCombination(m, random);
    assert.equal(Object.keys(selections).length, m.parameters.length);
    assert.equal(Consistency.conflicts(m, { selections }).excluded.length, 0);
  }
  assert.equal(Consistency.countConsistent(m), 30_246_750n);
});
