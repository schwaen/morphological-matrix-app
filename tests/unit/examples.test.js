import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadApp, plain } from './load.js';

const { Model, Examples, Consistency, Evaluation } = loadApp();
const examples = await Examples.all();

/**
 * Notizen, Status, Verträglichkeiten und eigene Merkmale sind in Dateien optional (fehlend = leer bzw. „Entwurf“);
 * für den Vergleich mit `normalize` ergänzen.
 */
function withEmptyNotes(data) {
  const d = plain(data);
  const fill = x => { if (x.note === undefined) x.note = ''; };
  d.parameters.forEach(p => {
    fill(p);
    p.options.forEach(o => { fill(o); if (o.values === undefined) o.values = {}; });
  });
  if (d.settings.attributes === undefined) d.settings.attributes = [];
  d.concepts.forEach(c => {
    fill(c);
    if (c.status === undefined) c.status = 'draft';
    if (c.statusNote === undefined) c.statusNote = '';
  });
  if (d.constraints === undefined) d.constraints = [];
  return d;
}

test('Jede Beispiel-Datei ist eingetragen; id entspricht dem Dateinamen', () => {
  const files = fs.readdirSync('examples').filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
  assert.deepEqual([...Examples.ids()].sort(), files.sort(), 'jede Datei unter examples/ in js/examples.js eingetragen');
  assert.deepEqual(examples.map(e => e.id), Examples.ids(), 'id in der Datei = Eintrag in js/examples.js');
});

for (const ex of examples) {
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

test('Laden ergibt jeweils eine eigene Kopie', async () => {
  const a = await Examples.load('kaffeemaschine');
  const b = await Examples.load('kaffeemaschine');
  a.title = 'geändert';
  a.parameters[0].options.pop();
  assert.equal(b.title, 'Beispiel: Kaffeemaschine');
  assert.equal((await Examples.load('kaffeemaschine')).parameters[0].options.length, b.parameters[0].options.length);
  assert.equal(Examples.loadFirst().title, 'Beispiel: Kaffeemaschine');
  assert.equal(await Examples.load('gibt-es-nicht'), null);
});

test('Food-Truck: automatische Konzepte und MoSCoW-Pfade sind verträglich, das Stammtisch-Konzept nicht', async () => {
  const m = await Examples.load('food-truck');
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

test('Krimi: alle Konzepte ohne Logikfehler, Zufall bleibt widerspruchsfrei', async () => {
  const m = await Examples.load('krimi');
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
