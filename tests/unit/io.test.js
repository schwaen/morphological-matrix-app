import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Model, IO } = loadApp();

test('Dateinamen aus dem Titel', () => {
  const m = Model.exampleState();
  assert.equal(IO.fileName(m, 'json'), 'beispiel-kaffeemaschine.json');
  assert.equal(IO.fileName(m, 'csv'), 'beispiel-kaffeemaschine.csv');
});

test('JSON-Export lässt sich unverändert wieder einlesen', () => {
  const m = Model.exampleState();
  assert.deepEqual(plain(Model.normalize(JSON.parse(IO.toJson(m)))), plain(m));
});

test('CSV: BOM, Semikolon, Kategorien, Konzepte', () => {
  const csv = IO.toCsv(Model.exampleState());
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], '"Titel";"Beispiel: Kaffeemaschine"');
  assert.equal(lines[3], '"Kategorie";"Parameter";"Ausprägung 1";"Ausprägung 2";"Ausprägung 3";"Ausprägung 4"');
  assert.ok(lines.includes('"Brühsystem";"Wassererwärmung";"Durchlauferhitzer";"Boiler";"Thermoblock";"Induktion"'));
  assert.ok(lines.some(l => l.startsWith('"Kompakt-Espresso";"Thermoblock"')));
  assert.ok(!csv.includes('Gesamtkosten'), 'ohne Bewertung keine Kennzahlen');
});

test('CSV mit Bewertung: Kennzahlen mit Dezimalkomma', () => {
  const m = Model.exampleState();
  m.settings.costs = true;
  m.settings.utility = true;
  const csv = IO.toCsv(m);
  assert.match(csv, /"Kategorie";"Parameter";"Gewicht";"Ausprägung";"Kosten \(EUR\)";"Nutzwert \(0–10\)"/);
  assert.match(csv, /"Kompakt-Espresso";.*;54;7,25;7,45/);
});

test('CSV maskiert Anführungszeichen', () => {
  const m = Model.blankState();
  m.title = 'Er sagte "Hallo"';
  assert.match(IO.toCsv(m), /"Er sagte ""Hallo"""/);
});

test('Teilen-Link: Rundreise und ungültige Daten', () => {
  const m = Model.exampleState();
  m.title = 'Geteilt – mit Ümlauten';
  const back = IO.decodeShareHash(`#m=${IO.encodeShare(m)}`);
  assert.deepEqual(plain(back), plain(m));
  assert.equal(IO.decodeShareHash('#etwas-anderes'), null);
  assert.equal(IO.decodeShareHash(''), null);
  assert.throws(() => IO.decodeShareHash('#m=AAAA'));
});
