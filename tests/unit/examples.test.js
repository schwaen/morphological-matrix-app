import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadApp, plain, EXAMPLE_FILES } from './load.js';

const { Model, Examples } = loadApp();

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
    assert.deepEqual(plain(Model.normalize(plain(ex.data))), plain(ex.data));
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
