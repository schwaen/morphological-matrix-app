import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Model, example: kaffeemaschine } = loadApp();

test('Beispiel ist bereits normalisiert (Normalisierung ändert nichts)', () => {
  const m = kaffeemaschine();
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
  assert.deepEqual(plain(m.settings), { costs: false, utility: false, currency: 'EUR', utilityMax: 10, moscow: false });
  assert.ok(p.options.every(o => o.priority === null));
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
  const m = kaffeemaschine();
  const groups = Model.categoryGroups(m);
  assert.deepEqual(plain(groups.map(g => g.cat && g.cat.name)), ['Brühsystem', 'Nutzung & Betrieb']);
  assert.deepEqual(plain(groups.flatMap(g => g.items.map(x => x.pi))), [0, 1, 2, 3, 4, 5]);
  // Ohne Kategorien genau eine Gruppe ohne Kopf
  const blank = Model.blankState();
  assert.deepEqual(plain(Model.categoryGroups(blank).map(g => g.cat)), [null]);
});

test('canMoveParameter: nur innerhalb der Kategorie', () => {
  const m = kaffeemaschine();
  assert.equal(Model.canMoveParameter(m, 0, -1), false);
  assert.equal(Model.canMoveParameter(m, 0, 1), true);
  assert.equal(Model.canMoveParameter(m, 2, 1), false); // Grenze zwischen den Kategorien
  assert.equal(Model.canMoveParameter(m, 5, 1), false);
});

test('Farben und Namen: nächste freie Farbe, eindeutige Namen', () => {
  const m = kaffeemaschine();
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

test('Datenformat: aktuelle Version wird geschrieben', () => {
  assert.equal(kaffeemaschine().version, Model.SCHEMA_VERSION);
  assert.equal(Model.blankState().version, Model.SCHEMA_VERSION);
  assert.equal(Model.normalize({ parameters: [] }).version, Model.SCHEMA_VERSION);
});

test('Datenformat: Version 1 (Ausprägungen als Texte) wird migriert', () => {
  const v1 = { version: 1, parameters: [{ id: 'p', options: ['a', { id: 'o2', text: 'b' }] }] };
  const m = Model.normalize(v1);
  assert.deepEqual(plain(m.parameters[0].options.map(o => o.text)), ['a', 'b']);
  assert.equal(m.parameters[0].options[1].id, 'o2');
  // Ohne Versionsangabe gilt Version 1
  assert.equal(Model.normalize({ parameters: [{ options: ['x'] }] }).parameters[0].options[0].text, 'x');
});

test('Datenformat: Daten aus einer neueren Version werden abgelehnt', () => {
  assert.throws(() => Model.normalize({ version: Model.SCHEMA_VERSION + 1, parameters: [] }), /neueren Version/);
});

test('Datenformat: jede Version hat eine Migration bis zur aktuellen', () => {
  for (let v = 1; v < Model.SCHEMA_VERSION; v++) {
    assert.doesNotThrow(() => Model.migrate({ version: v, parameters: [] }), `Migration ${v} → ${v + 1}`);
  }
});

test('Priorität (MoSCoW): gültige Werte bleiben, ungültige werden verworfen', () => {
  const m = Model.normalize({
    version: 3,
    settings: { moscow: true },
    parameters: [{ id: 'p', options: [
      { id: 'a', text: 'a', priority: 'must' }, { id: 'b', text: 'b', priority: 'wont' },
      { id: 'c', text: 'c', priority: 'MUST' }, { id: 'd', text: 'd' },
    ] }],
  });
  assert.equal(m.settings.moscow, true);
  assert.deepEqual(plain(m.parameters[0].options.map(o => o.priority)), ['must', 'wont', null, null]);
});

test('Datenformat: Version 2 wird ohne Verlust auf die aktuelle Version gebracht', () => {
  const v2 = { version: 2, settings: { costs: true }, parameters: [{ id: 'p', options: [{ id: 'o', text: 'x', cost: 5 }] }] };
  const m = Model.normalize(v2);
  assert.equal(m.version, Model.SCHEMA_VERSION);
  assert.equal(m.settings.costs, true);
  assert.equal(m.settings.moscow, false);
  assert.equal(m.parameters[0].options[0].cost, 5);
  assert.equal(m.parameters[0].options[0].priority, null);
  assert.equal(m.parameters[0].options[0].note, '');
});

test('Notizen: Version 3 ohne Notizen wird übernommen, Notizen bleiben beim Normalisieren erhalten', () => {
  const v3 = { version: 3, parameters: [{ id: 'p', options: [{ id: 'o', text: 'x' }] }], concepts: [{ id: 'c', selections: {} }] };
  const m = Model.normalize(v3);
  assert.equal(m.version, Model.SCHEMA_VERSION);
  assert.deepEqual([m.parameters[0].note, m.parameters[0].options[0].note, m.concepts[0].note], ['', '', '']);
  m.parameters[0].note = 'Beschreibung';
  m.parameters[0].options[0].note = 'Notiz';
  m.concepts[0].note = 'Begründung\nzweite Zeile';
  assert.deepEqual(plain(Model.normalize(plain(m))), plain(m));
  m.parameters[0].options[0].note = null;
  assert.equal(Model.normalize(plain(m)).parameters[0].options[0].note, '');
});

test('differingParameters: nur Parameter mit unterschiedlicher Wahl, „nicht gewählt“ zählt mit', () => {
  const m = kaffeemaschine();
  const all = Model.differingParameters(m);
  const same = m.parameters.filter(p => !all.has(p.id)).map(p => p.name);
  assert.deepEqual(same, m.parameters.filter(p => new Set(m.concepts.map(c => c.selections[p.id])).size === 1).map(p => p.name));
  const p = m.parameters[0];
  m.concepts.forEach(c => { c.selections[p.id] = p.options[0].id; });
  assert.equal(Model.differingParameters(m).has(p.id), false);
  delete m.concepts[1].selections[p.id];
  assert.equal(Model.differingParameters(m).has(p.id), true);
  m.concepts.splice(1);
  assert.equal(Model.differingParameters(m).size, 0);
});

test('search: Parameternamen und Ausprägungen, ohne Groß-/Kleinschreibung und Akzente', () => {
  const m = kaffeemaschine();
  const p = m.parameters[0];
  p.name = 'Wassererwärmung';
  p.options[0].text = 'Café-Größe';
  let r = Model.search(m, 'WAERM');
  assert.equal(r.hits.length, 0);
  r = Model.search(m, 'erwarm');
  assert.deepEqual(plain(r.hits[0]), { pid: p.id, oid: null });
  r = Model.search(m, 'cafe-gross');
  assert.deepEqual(plain(r.hits), [{ pid: p.id, oid: p.options[0].id }]);
  assert.ok(r.params.has(p.id) && r.options.has(p.options[0].id));
  assert.equal(Model.search(m, '   ').hits.length, 0);
  // Notizen werden mit durchsucht
  p.options[1].note = 'Zischt im Betrieb';
  m.parameters[1].note = 'Beeinflusst den Schaumkranz';
  assert.deepEqual(plain(Model.search(m, 'zischt').hits), [{ pid: p.id, oid: p.options[1].id }]);
  assert.deepEqual(plain(Model.search(m, 'schaumkranz').hits), [{ pid: m.parameters[1].id, oid: null }]);
});
