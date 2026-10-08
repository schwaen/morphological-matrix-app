import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Model, Ops, example: kaffeemaschine } = loadApp();

const names = list => plain(list.map(x => x.name));
const texts = p => plain(p.options.map(o => o.text));
/** Matrix ohne Kategorien mit Parametern A, B, C (je Ausprägungen a1, a2 …). */
function simple() {
  const m = Model.blankState();
  m.parameters = ['A', 'B', 'C'].map(n => ({
    id: n, name: n, weight: null, categoryId: null,
    options: [1, 2, 3].map(i => ({ id: `${n}${i}`, text: `${n.toLowerCase()}${i}`, cost: null, score: null, priority: null })),
  }));
  m.concepts = [
    { id: 'k1', name: 'Eins', color: '#000000', selections: { A: 'A1', B: 'B2' } },
    { id: 'k2', name: 'Zwei', color: '#111111', selections: { A: 'A2' } },
    { id: 'k3', name: 'Drei', color: '#222222', selections: {} },
  ];
  m.activeConceptId = 'k2';
  return m;
}

test('Parameter: hinzufügen hält die Gruppierung nach Kategorien', () => {
  const m = kaffeemaschine();
  const first = m.categories[0].id;
  Ops.addParameter(m, Model.newParameter(first, 'Neu'));
  // Neuer Parameter steht am Ende seiner Kategorie, nicht am Ende der Liste
  assert.equal(m.parameters[3].name, 'Neu');
  assert.deepEqual(plain(m.parameters.map(p => p.categoryId)), plain([first, first, first, first, ...m.parameters.slice(4).map(() => m.categories[1].id)]));
});

test('Parameter: verschieben mit Bereichsprüfung, löschen entfernt Auswahlen', () => {
  const m = simple();
  assert.equal(Ops.moveParameter(m, 0, 1), true);
  assert.deepEqual(names(m.parameters), ['B', 'A', 'C']);
  assert.equal(Ops.moveParameter(m, 0, -1), false);
  assert.equal(Ops.moveParameter(m, 2, 1), false);
  assert.deepEqual(names(m.parameters), ['B', 'A', 'C']);

  assert.equal(Ops.deleteParameter(m, 'A'), true);
  assert.deepEqual(names(m.parameters), ['B', 'C']);
  assert.deepEqual(plain(m.concepts[0].selections), { B: 'B2' });
  assert.equal(Ops.deleteParameter(m, 'gibt-es-nicht'), false);
});

test('Ausprägungen: einfügen, verschieben, löschen', () => {
  const m = simple();
  const p = m.parameters[0];
  Ops.addOption(m, 'A', { ...Model.newOption(), text: 'neu' }, 0);
  assert.deepEqual(texts(p), ['a1', 'neu', 'a2', 'a3']);
  Ops.addOption(m, 'A', { ...Model.newOption(), text: 'ende' });
  assert.deepEqual(texts(p), ['a1', 'neu', 'a2', 'a3', 'ende']);
  assert.equal(Ops.addOption(m, 'X', Model.newOption()), false);

  assert.equal(Ops.moveOption(m, 'A', 0, 1), true);
  assert.deepEqual(texts(p).slice(0, 2), ['neu', 'a1']);
  assert.equal(Ops.moveOption(m, 'A', 4, 1), false);

  // Nur Konzepte, die genau diese Ausprägung gewählt hatten, verlieren die Auswahl
  Ops.deleteOption(m, 'A', 'A1');
  assert.deepEqual(plain(m.concepts[0].selections), { B: 'B2' });
  assert.deepEqual(plain(m.concepts[1].selections), { A: 'A2' });
});

test('Priorität: setzen, wechseln, erneut wählen entfernt sie', () => {
  const m = simple();
  const o = m.parameters[0].options[0];
  Ops.togglePriority(m, 'A', 'A1', 'must');
  assert.equal(o.priority, 'must');
  Ops.togglePriority(m, 'A', 'A1', 'wont');
  assert.equal(o.priority, 'wont');
  Ops.togglePriority(m, 'A', 'A1', 'wont');
  assert.equal(o.priority, null);
  assert.equal(Ops.togglePriority(m, 'A', 'X', 'must'), false);
});

test('Kategorien: verschieben nimmt Parameter mit, löschen behält sie ohne Kategorie', () => {
  const m = kaffeemaschine();
  const [k1, k2] = m.categories.map(k => k.id);
  assert.equal(Ops.moveCategory(m, 0, 1), true);
  assert.equal(m.parameters[0].categoryId, k2);
  assert.equal(m.parameters[5].categoryId, k1);
  assert.equal(Ops.moveCategory(m, 1, 1), false);

  assert.equal(Ops.deleteCategory(m, k2), true);
  assert.deepEqual(plain(m.categories.map(k => k.id)), [k1]);
  // Parameter ohne Kategorie stehen zuletzt
  assert.deepEqual(plain(m.parameters.map(p => p.categoryId)), [k1, k1, k1, null, null, null]);
});

test('Kategorie eines Parameters setzen; unbekannte Kategorie wird abgelehnt', () => {
  const m = kaffeemaschine();
  const pid = m.parameters[0].id;
  const k2 = m.categories[1].id;
  assert.equal(Ops.setParameterCategory(m, pid, k2), true);
  assert.equal(m.parameters.find(p => p.id === pid).categoryId, k2);
  // Stabile Sortierung: bleibt vor den bisherigen Parametern der Kategorie (Gruppierung bleibt erhalten)
  assert.equal(m.parameters[2].id, pid);
  assert.deepEqual(plain(m.parameters.map(p => p.categoryId)), [m.categories[0].id, m.categories[0].id, k2, k2, k2, k2]);
  assert.equal(Ops.setParameterCategory(m, pid, 'gibt-es-nicht'), false);
  assert.equal(Ops.setParameterCategory(m, pid, null), true);
  assert.equal(m.parameters.find(p => p.id === pid).categoryId, null);
});

test('Konzepte: Auswahl umschalten, aktives Konzept wird bei Bedarf angelegt', () => {
  const m = simple();
  Ops.toggleSelection(m, 'B', 'B1');
  assert.deepEqual(plain(m.concepts[1].selections), { A: 'A2', B: 'B1' });
  Ops.toggleSelection(m, 'B', 'B1');
  assert.deepEqual(plain(m.concepts[1].selections), { A: 'A2' });

  m.concepts = [];
  m.activeConceptId = null;
  Ops.toggleSelection(m, 'A', 'A3');
  assert.equal(m.concepts.length, 1);
  assert.equal(m.activeConceptId, m.concepts[0].id);
  assert.deepEqual(plain(m.concepts[0].selections), { A: 'A3' });
});

test('Konzepte: duplizieren hinter dem Original mit eigener Auswahl', () => {
  const m = simple();
  const copy = Ops.duplicateConcept(m, 'k1');
  assert.deepEqual(names(m.concepts), ['Eins', copy.name, 'Zwei', 'Drei']);
  assert.match(copy.name, /Eins/);
  assert.equal(m.activeConceptId, copy.id);
  copy.selections.C = 'C1';
  assert.equal(m.concepts[0].selections.C, undefined); // nicht geteilt
  assert.equal(Ops.duplicateConcept(m, 'X'), null);
});

test('Konzepte: löschen wählt Nachfolger, sonst Vorgänger, sonst keines', () => {
  const m = simple();
  Ops.deleteConcept(m, 'k2');
  assert.equal(m.activeConceptId, 'k3');
  Ops.deleteConcept(m, 'k3');
  assert.equal(m.activeConceptId, 'k1');
  Ops.deleteConcept(m, 'k1');
  assert.equal(m.activeConceptId, null);
  assert.equal(Ops.deleteConcept(m, 'k1'), false);
});

test('Konzepte: zufällig belegen (ohne leere Parameter) und leeren', () => {
  const m = simple();
  m.parameters[2].options = [];
  const seq = [0, 0.99];
  Ops.randomizeActive(m, () => seq.shift());
  assert.deepEqual(plain(m.concepts[1].selections), { A: 'A1', B: 'B3' });
  assert.equal(Ops.clearActive(m), true);
  assert.deepEqual(plain(m.concepts[1].selections), {});
  assert.equal(Ops.clearActive(m), false);
});

test('Nutzwert-Skala: mit und ohne Umrechnung', () => {
  const m = simple();
  m.parameters[0].options[0].score = 7;
  m.parameters[0].options[1].score = 3.33;
  Ops.changeScale(m, 5, false);
  assert.equal(m.settings.utilityMax, 5);
  assert.equal(m.parameters[0].options[0].score, 7);
  Ops.changeScale(m, 100, true);
  assert.equal(m.settings.utilityMax, 100);
  assert.deepEqual(plain(m.parameters[0].options.map(o => o.score)), [140, 66.6, null]);
});

test('addCategory und addConcept hängen an; neues Konzept wird aktiv', () => {
  const m = kaffeemaschine();
  const k = { id: 'k-neu', name: 'Neu', color: '#123456' };
  Ops.addCategory(m, k);
  assert.equal(m.categories.at(-1), k);
  const c = { id: 'c-neu', name: 'Neu', color: '#654321', selections: {}, note: '' };
  Ops.addConcept(m, c);
  assert.equal(m.concepts.at(-1), c);
  assert.equal(m.activeConceptId, 'c-neu');
});
