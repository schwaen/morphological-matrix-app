/*
 * Zustand der Oberfläche: geöffnete App-Tabs, die Matrix des aktiven Tabs, Ansicht,
 * Speichern sowie Rückgängig/Wiederholen.
 *
 * Die Variablen `docId`, `state`, `prefs`, `undoStack` und `redoStack` beschreiben immer den
 * AKTIVEN App-Tab. Beim Wechsel (js/ui/tabs.js) wird dieser Stand im Tab-Eintrag abgelegt und
 * der des Ziel-Tabs geladen – der übrige Code muss von Tabs nichts wissen.
 *
 * Regeln für Änderungen:
 *  - Strukturelle Änderungen laufen über `mutate()` (Verlaufseintrag, Speichern, komplettes Neuzeichnen).
 *  - Texteingaben laufen über `bindField()` (kein Neuzeichnen beim Tippen, Verlaufseintrag beim Verlassen).
 *  - Ansichtseinstellungen über `setPref()`; sie sind nicht Teil des Verlaufs.
 */
'use strict';

const HISTORY_LIMIT = 200;
/** @type {TabPrefs} */
const DEFAULT_PREFS = { mode: 'select', showLines: true, compareOpen: true };
/** Ansichtseinstellungen, die jeder App-Tab für sich behält (`showLines` gilt für alle). */
const VIEW_KEYS = /** @type {const} */ (['mode', 'compareOpen', 'collapsed']);
const CLOSED_LIMIT = 8;

/**
 * Ein geöffneter App-Tab. Für inaktive Tabs liegen Matrix, Verlauf und Scroll-Position hier;
 * für den aktiven Tab gelten die globalen Variablen.
 * @typedef {{ docId: string, view: Partial<TabView>, state?: Matrix, undo?: string[], redo?: string[],
 *             lastSaved?: string | null, scrollY?: number, external?: boolean }} AppTab
 */

/** @param {TabPrefs | Partial<TabView>} source @returns {Partial<TabView>} */
const pickView = source => Object.fromEntries(VIEW_KEYS.filter(k => k in source).map(k => [k, source[k]]));

/**
 * Geöffnete App-Tabs beim Start: gespeicherter Arbeitsbereich (nur noch vorhandene Matrizen),
 * sonst wie früher die zuletzt bearbeitete Matrix bzw. das Beispiel. `?doc=` öffnet zusätzlich
 * eine bestimmte Matrix (Link aus älteren Versionen bzw. Lesezeichen).
 */
function loadInitialTabs() {
  Store.migrateLegacy();
  const ws = Store.loadWorkspace();
  /** @type {AppTab[]} */
  const list = [];
  for (const t of (ws && ws.tabs) || []) {
    const doc = t && Store.readDoc(t.docId);
    if (doc && !list.some(x => x.docId === doc.id)) list.push({ docId: doc.id, view: t.view || {}, state: doc.data });
  }
  let active = ws && list.some(t => t.docId === ws.active) ? ws.active : null;

  const params = new URLSearchParams(location.search);
  const requested = params.get('doc');
  if (requested != null) {
    // Parameter entfernen, damit ein späteres Neuladen den gespeicherten Arbeitsbereich zeigt.
    params.delete('doc');
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
    const doc = Store.readDoc(requested);
    if (doc) {
      if (!list.some(t => t.docId === doc.id)) list.push({ docId: doc.id, view: {}, state: doc.data });
      active = doc.id;
    }
  }

  if (!list.length) {
    const doc = Store.readDoc(Store.legacyTabDocId()) || Store.listDocs()[0]
      || { id: Util.uid(), data: Model.exampleState() };
    list.push({ docId: doc.id, view: {}, state: doc.data });
  }
  return { list, active: active || list[0].docId, closed: (ws && Array.isArray(ws.closed)) ? ws.closed : [] };
}

const initial = loadInitialTabs();
/** @type {AppTab[]} */
const tabs = initial.list;
/** Zuletzt geschlossene Matrizen (IDs, neueste zuerst). @type {string[]} */
// eslint-disable-next-line prefer-const -- wird in tabs.js und dialogs.js neu gesetzt
let closedTabs = initial.closed;

const initialTab = tabs.find(t => t.docId === initial.active);
// eslint-disable-next-line prefer-const -- wird beim Tab-Wechsel (tabs.js) neu gesetzt
let docId = initialTab.docId;
/** @type {Matrix} */
let state = initialTab.state;
/** @type {TabPrefs} */
const prefs = { ...Store.loadPrefs(DEFAULT_PREFS), ...initialTab.view };
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
  if (!Store.writeDoc(docId, state)) toast(Texts.errors.storageFull);
}

/** Geöffnete Tabs, aktiven Tab und deren Ansichten merken. @param {{ tabOnly?: boolean }} [opts] */
function saveWorkspace(opts) {
  Store.saveWorkspace({
    tabs: tabs.map(t => ({ docId: t.docId, view: t.docId === docId ? pickView(prefs) : t.view })),
    active: docId,
    closed: closedTabs.slice(0, CLOSED_LIMIT),
  }, opts);
}

/**
 * Ansichtseinstellung des aktiven Tabs ändern und merken (auch als Vorgabe für neue Tabs).
 * @template {keyof TabPrefs} K
 * @param {K} key @param {TabPrefs[K]} value
 */
function setPref(key, value) {
  prefs[key] = value;
  Store.savePrefs(prefs);
  saveWorkspace();
}

// ---------- Verlauf (Rückgängig / Wiederholen) – je App-Tab ----------

/** @type {string[]} */
let undoStack = [];
/** @type {string[]} */
let redoStack = [];
const snapshot = () => JSON.stringify(state);

function pushHistory(snap) {
  undoStack.push(snap);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}

function clearHistory() {
  undoStack = [];
  redoStack = [];
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

/** Übernimmt den Stand, den ein anderer Browser-Tab für die aktive Matrix gespeichert hat. */
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
