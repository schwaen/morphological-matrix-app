import { afterEach, beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { loadApp, plain } from './load.js';

const { Store, Model, example: kaffeemaschine } = loadApp();

/** Web Storage im Arbeitsspeicher; `full` simuliert einen vollen, `blocked` einen gesperrten Speicher. */
class MemoryStorage {
  constructor() { this.map = new Map(); this.full = false; this.blocked = false; }
  check() { if (this.blocked) throw new Error('SecurityError'); }
  get length() { this.check(); return this.map.size; }
  key(i) { this.check(); return [...this.map.keys()][i] ?? null; }
  getItem(k) { this.check(); return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.check(); if (this.full) throw new Error('QuotaExceededError'); this.map.set(k, String(v)); }
  removeItem(k) { this.check(); this.map.delete(k); }
}

let local;
let session;
beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('window', globalThis);
});
afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('navigator', { language: 'de-DE' }); });

test('Matrix schreiben, lesen (normalisiert), auflisten und entfernen', () => {
  const m = kaffeemaschine();
  assert.equal(Store.writeDoc('a', m, 1000), true);
  Store.writeDoc('b', { ...m, title: 'Zweite' }, 2000);
  local.setItem('fremder:schluessel', 'x'); // gehört nicht zur App
  const doc = Store.readDoc('a');
  assert.equal(doc.savedAt, 1000);
  assert.deepEqual(plain(doc.data), plain(Model.normalize(plain(m))));
  assert.deepEqual(Store.listDocs().map(d => d.id), ['b', 'a'], 'zuletzt gespeicherte zuerst');
  Store.removeDoc('a');
  assert.equal(Store.readDoc('a'), null);
  assert.equal(Store.readDoc('gibt-es-nicht'), null);
});

test('Beschädigte Einträge werden übersprungen statt die Liste abzubrechen', () => {
  Store.writeDoc('gut', kaffeemaschine(), 5);
  local.setItem('morphologische-matrix:doc:kaputt', '{kein json');
  local.setItem('morphologische-matrix:doc:neuer', JSON.stringify({ savedAt: 9, data: { version: 999, parameters: [] } }));
  assert.equal(Store.readDoc('kaputt'), null);
  assert.equal(Store.readDoc('neuer'), null, 'Daten aus einer neueren App-Version');
  assert.deepEqual(Store.listDocs().map(d => d.id), ['gut']);
});

test('Voller oder gesperrter Speicher: Schreiben meldet false, Lesen liefert leere Werte', () => {
  local.full = true;
  assert.equal(Store.writeDoc('a', kaffeemaschine()), false);
  local.full = false;
  Store.writeDoc('a', kaffeemaschine());
  local.blocked = true;
  session.blocked = true;
  assert.equal(Store.readDoc('a'), null);
  assert.deepEqual(Store.listDocs(), []);
  assert.equal(Store.loadWorkspace(), null);
  assert.equal(Store.legacyTabDocId(), '');
  Store.removeDoc('a'); // wirft nicht
  Store.saveWorkspace({ tabs: [], active: '', closed: [] }); // wirft nicht
});

test('docIdFromKey erkennt nur Schlüssel von Matrizen', () => {
  assert.equal(Store.docIdFromKey('morphologische-matrix:doc:abc'), 'abc');
  assert.equal(Store.docIdFromKey('morphologische-matrix:prefs'), null);
  assert.equal(Store.docIdFromKey(null), null);
});

test('Altdaten (eine einzige Matrix) werden übernommen und entfernt', () => {
  local.setItem('morphologische-matrix:v1', JSON.stringify(kaffeemaschine()));
  Store.migrateLegacy();
  assert.equal(local.getItem('morphologische-matrix:v1'), null);
  const docs = Store.listDocs();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].data.title, 'Beispiel: Kaffeemaschine');
  // Ungültige Altdaten werden verworfen, ohne etwas anzulegen
  local.setItem('morphologische-matrix:v1', '{kaputt');
  Store.migrateLegacy();
  assert.equal(local.getItem('morphologische-matrix:v1'), null);
  assert.equal(Store.listDocs().length, 1);
  Store.migrateLegacy(); // ohne Altdaten: nichts zu tun
  assert.equal(Store.listDocs().length, 1);
});

test('Arbeitsbereich: eigener Browser-Tab vor der Vorgabe für neue Tabs', () => {
  const mine = { tabs: [{ docId: 'a', view: {} }], active: 'a', closed: [] };
  const other = { tabs: [{ docId: 'b', view: {} }], active: 'b', closed: ['x'] };
  Store.saveWorkspace(other); // auch als Vorgabe
  assert.deepEqual(plain(Store.loadWorkspace()), other);
  Store.saveWorkspace(mine, { tabOnly: true });
  assert.deepEqual(plain(Store.loadWorkspace()), mine);
  assert.deepEqual(JSON.parse(local.getItem('morphologische-matrix:workspace')), other, 'Vorgabe unverändert');
  session.setItem('morphologische-matrix:workspace', '{"tabs": "keine Liste"}');
  assert.equal(Store.loadWorkspace(), null, 'ungültiger Arbeitsbereich');
  session.setItem('morphologische-matrix:workspace', '{kaputt');
  assert.equal(Store.loadWorkspace(), null);
});

test('Einstellungen: Vorgaben ergänzt, eigene vor fremden, alte Linien-Einstellung übernommen', () => {
  const defaults = { mode: 'select', lines: 'active', compareOpen: true };
  assert.deepEqual(plain(Store.loadPrefs(defaults)), defaults);
  Store.savePrefs({ ...defaults, mode: 'edit' });
  Store.savePrefs({ ...defaults, compareOpen: false }, { tabOnly: true });
  assert.deepEqual(plain(Store.loadPrefs(defaults)), { ...defaults, compareOpen: false });
  assert.equal(JSON.parse(local.getItem('morphologische-matrix:prefs')).mode, 'edit');
  session.setItem('morphologische-matrix:prefs', JSON.stringify({ showLines: false }));
  assert.deepEqual(plain(Store.loadPrefs(defaults)), { ...defaults, lines: 'off' });
  session.setItem('morphologische-matrix:prefs', '{kaputt');
  assert.deepEqual(plain(Store.loadPrefs(defaults)), defaults);
});

test('Tab-Zuordnung aus der Zeit vor den App-Tabs', () => {
  session.setItem('morphologische-matrix:tab-doc', 'alt-1');
  assert.equal(Store.legacyTabDocId(), 'alt-1');
});
