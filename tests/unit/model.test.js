import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Model } = loadApp();

test('Beispiel ist bereits normalisiert (Normalisierung ändert nichts)', () => {
  const m = Model.exampleState();
  assert.deepEqual(plain(Model.normalize(plain(m))), plain(m));
});

test('normalize: lehnt Daten ohne Parameter ab', () => {
  assert.throws(() => Model.normalize(null), /parameters/);
  assert.throws(() => Model.normalize({ title: 'x' }), /parameters/);
});

test('normalize: altes Format, Standardwerte und Bereinigung', () => {
  const m = Model.normalize({
    title: 'Alt',
    parameters: [{ id: 'p1', name: 'P', options: ['a', 'b'], weight: -1, categoryId: 'gibt-es-nicht' }],
    concepts: [{ id: 'c1', selections: { p1: 'unbekannt' }, color: 'rot' }],
    settings: { costs: 'ja', currency: 'XYZ', utilityMax: 7 },
  });
  const p = m.parameters[0];
  assert.deepEqual(plain(p.options.map(o => o.text)), ['a', 'b']);
  assert.ok(p.options.every(o => o.id && o.cost === null && o.score === null));
  assert.equal(p.weight, null);                 // negatives Gewicht verworfen
  assert.equal(p.categoryId, null);             // unbekannte Kategorie verworfen
  assert.deepEqual(plain(m.concepts[0].selections), {}); // ungültige Auswahl verworfen
  assert.equal(m.concepts[0].name, 'Konzept 1');
  assert.match(m.concepts[0].color, /^#[0-9a-f]{6}$/i);
  assert.deepEqual(plain(m.settings), { costs: false, utility: false, currency: 'EUR', utilityMax: 10 });
  assert.equal(m.activeConceptId, 'c1');
  assert.deepEqual(plain(m.categories), []);
});

test('normalize: doppelte IDs werden ersetzt', () => {
  const m = Model.normalize({
    parameters: [
      { id: 'x', options: [{ id: 'x', text: 'a' }] },
      { id: 'x', options: [{ id: 'y', text: 'b' }, { id: 'y', text: 'c' }] },
    ],
  });
  const ids = [...m.parameters.map(p => p.id), ...m.parameters.flatMap(p => p.options.map(o => o.id))];
  assert.equal(new Set(ids).size, ids.length);
});

test('sortedByCategory: Reihenfolge der Kategorien, ohne Kategorie zuletzt, sonst stabil', () => {
  const cats = [{ id: 'A' }, { id: 'B' }];
  const ps = [
    { id: '1', categoryId: null }, { id: '2', categoryId: 'B' }, { id: '3', categoryId: 'A' },
    { id: '4', categoryId: 'B' }, { id: '5', categoryId: null }, { id: '6', categoryId: 'A' },
  ];
  assert.deepEqual(plain(Model.sortedByCategory(cats, ps).map(p => p.id)), ['3', '6', '2', '4', '1', '5']);
});

test('categoryGroups: Gruppen und Indizes in Anzeigereihenfolge', () => {
  const m = Model.exampleState();
  const groups = Model.categoryGroups(m);
  assert.deepEqual(plain(groups.map(g => g.cat && g.cat.name)), ['Brühsystem', 'Nutzung & Betrieb']);
  assert.deepEqual(plain(groups.flatMap(g => g.items.map(x => x.pi))), [0, 1, 2, 3, 4, 5]);
  // Ohne Kategorien genau eine Gruppe ohne Kopf
  const blank = Model.blankState();
  assert.deepEqual(plain(Model.categoryGroups(blank).map(g => g.cat)), [null]);
});

test('canMoveParameter: nur innerhalb der Kategorie', () => {
  const m = Model.exampleState();
  assert.equal(Model.canMoveParameter(m, 0, -1), false);
  assert.equal(Model.canMoveParameter(m, 0, 1), true);
  assert.equal(Model.canMoveParameter(m, 2, 1), false); // Grenze zwischen den Kategorien
  assert.equal(Model.canMoveParameter(m, 5, 1), false);
});

test('Farben und Namen: nächste freie Farbe, eindeutige Namen', () => {
  const m = Model.exampleState();
  assert.equal(Model.nextConceptColor(m.concepts), Model.COLORS[3]);
  assert.equal(Model.nextCategoryColor(m.categories), Model.CATEGORY_COLORS[2]);
  assert.equal(Model.uniqueName(['A', 'A 2'], 'A'), 'A 3');
  assert.equal(Model.uniqueName(['B'], 'A'), 'A');
  assert.equal(Model.newConcept(m).name, 'Konzept 4');
});

test('optionText und sameSelections', () => {
  const p = { id: 'p', options: [{ id: 'a', text: ' X ' }, { id: 'b', text: '' }] };
  assert.equal(Model.optionText(p, 'a'), 'X');
  assert.equal(Model.optionText(p, 'b'), '(Ausprägung 2)');
  assert.equal(Model.optionText(p, 'z'), null);
  assert.equal(Model.sameSelections({ a: '1', b: '2' }, { b: '2', a: '1' }), true);
  assert.equal(Model.sameSelections({ a: '1' }, { a: '1', b: '2' }), false);
});
