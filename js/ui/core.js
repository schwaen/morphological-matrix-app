/*
 * Zustand der Oberfläche: aktuelle Matrix dieses Tabs, Ansichtseinstellungen,
 * Speichern sowie Rückgängig/Wiederholen.
 *
 * Regeln für Änderungen:
 *  - Strukturelle Änderungen laufen über `mutate()` (Verlaufseintrag, Speichern, komplettes Neuzeichnen).
 *  - Texteingaben laufen über `bindField()` (kein Neuzeichnen beim Tippen, Verlaufseintrag beim Verlassen).
 *  - Ansichtseinstellungen (pro Tab) über `setPref()`; sie sind nicht Teil des Verlaufs.
 */
'use strict';

const HISTORY_LIMIT = 200;
/** @type {TabPrefs} */
const DEFAULT_PREFS = { mode: 'select', showLines: true, compareOpen: true };

/** Matrix für diesen Tab: per `?doc=`, sonst die zuletzt hier geöffnete, sonst die zuletzt bearbeitete. */
function loadInitialDoc() {
  Store.migrateLegacy();
  const params = new URLSearchParams(location.search);
  const requested = params.get('doc');
  if (requested != null) {
    // Parameter entfernen, damit ein späteres Neuladen die aktuelle Tab-Matrix zeigt.
    params.delete('doc');
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
    const doc = Store.readDoc(requested);
    if (doc) return doc;
  }
  const tabDoc = Store.readDoc(Store.tabDocId());
  if (tabDoc) return tabDoc;
  const [latest] = Store.listDocs();
  if (latest) return latest;
  return { id: Util.uid(), data: Model.exampleState() };
}

const initialDoc = loadInitialDoc();
let docId = initialDoc.id;
/** @type {Matrix} */
let state = initialDoc.data;
/** @type {TabPrefs} */
const prefs = Store.loadPrefs(DEFAULT_PREFS);
/** `data-fid` des Felds, das nach dem nächsten Neuzeichnen den Fokus bekommt. */
// eslint-disable-next-line prefer-const -- wird in Aktionen und beim Rendern neu gesetzt
let pendingFocus = null;
/** Beim Drucken werden alle Kategorien ausgeklappt. */
// eslint-disable-next-line prefer-const -- wird beim Drucken in main.js umgeschaltet
let printing = false;

const activeConcept = () => state.concepts.find(c => c.id === state.activeConceptId) || null;
/** Betrag in der Währung der aktuellen Matrix. @param {number} n */
const money = n => Util.formatMoney(n, state.settings.currency);

// ---------- Speichern ----------

let lastSaved = null;
function save() {
  const json = JSON.stringify(state);
  if (json === lastSaved) return;
  lastSaved = json;
  Store.setTabDocId(docId);
  if (!Store.writeDoc(docId, state)) toast(Texts.errors.storageFull);
}

/**
 * Ansichtseinstellung dieses Tabs ändern und merken (auch als Vorgabe für neue Tabs).
 * @template {keyof TabPrefs} K
 * @param {K} key @param {TabPrefs[K]} value
 */
function setPref(key, value) {
  prefs[key] = value;
  Store.savePrefs(prefs);
}

// ---------- Verlauf (Rückgängig / Wiederholen) ----------

const undoStack = [];
const redoStack = [];
const snapshot = () => JSON.stringify(state);

function pushHistory(snap) {
  undoStack.push(snap);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}

function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
}

/** Strukturelle Änderung: Verlauf sichern, ändern, speichern, neu zeichnen. @param {(m: Matrix) => void} fn */
function mutate(fn) {
  pushHistory(snapshot());
  fn(state);
  save();
  render();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  state = JSON.parse(undoStack.pop());
  save();
  render();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  state = JSON.parse(redoStack.pop());
  save();
  render();
}

/**
 * Bindet ein Textfeld an den Zustand, ohne beim Tippen neu zu rendern
 * (sonst ginge der Fokus verloren). Der Verlaufseintrag entsteht beim Verlassen.
 * @param {any} el
 * @param {(value: string) => void} apply
 * @param {() => void} [after] Aktualisierung nach jeder Eingabe (Standard: `refreshLight`)
 */
function bindField(el, apply, after = refreshLight) {
  el.addEventListener('focus', () => { el._snap = snapshot(); });
  el.addEventListener('input', () => {
    if (el._snap == null) el._snap = snapshot();
    apply(el.value);
    save();
    after();
  });
  el.addEventListener('change', () => {
    if (el._snap != null && el._snap !== snapshot()) pushHistory(el._snap);
    el._snap = snapshot();
  });
}

// ---------- Matrix wechseln ----------

/** Öffnet in diesem Tab eine andere Matrix; andere Tabs bleiben unberührt. */
function openDoc(id, data, message) {
  docId = id;
  state = data;
  lastSaved = null;
  clearHistory();
  save();
  render();
  if (message) toast(message);
}

/** Legt eine neue Matrix an und öffnet sie in diesem Tab. */
function openNewDoc(data, message) {
  openDoc(Util.uid(), data, message);
}

/** Übernimmt den Stand, den ein anderer Tab für dieselbe Matrix gespeichert hat. */
function adoptExternalChange() {
  const doc = Store.readDoc(docId);
  if (!doc) return;
  state = doc.data;
  lastSaved = JSON.stringify(state);
  clearHistory(); // eigener Verlauf passt nicht mehr zum fremden Stand
  render();
}

// ---------- Ansicht ----------

/** @param {TabPrefs['mode']} mode */
function setMode(mode) {
  setPref('mode', mode);
  render();
}

/** @param {string | null} cid */
const collapseKey = cid => cid || Model.NO_CATEGORY;
/** @param {string | null} cid */
const isCollapsed = cid => !printing && !!(prefs.collapsed && prefs.collapsed[collapseKey(cid)]);

/** @param {string | null} cid @param {boolean} value */
function setCollapsed(cid, value) {
  const next = { ...(prefs.collapsed || {}) };
  if (value) next[collapseKey(cid)] = true;
  else delete next[collapseKey(cid)];
  setPref('collapsed', next);
}
