/*
 * Zustand der Oberfläche: geöffnete App-Tabs, die Matrix des aktiven Tabs, Ansicht,
 * Speichern sowie Rückgängig/Wiederholen.
 *
 * Die Variablen `docId`, `state`, `prefs`, `undoStack` und `redoStack` beschreiben immer den
 * AKTIVEN App-Tab. Beim Wechsel (js/ui/tabs.js) wird dieser Stand im Tab-Eintrag abgelegt und
 * der des Ziel-Tabs geladen – der übrige Code muss von Tabs nichts wissen.
 *
 * Regeln für Änderungen:
 *  - Strukturelle Änderungen laufen über `mutate()` (Verlaufseintrag, Speichern, Neuzeichnen).
 *  - Texteingaben laufen über `fieldProps()` (verzögertes Speichern beim Tippen, Verlaufseintrag
 *    beim Verlassen).
 *  - Ansichtseinstellungen über `setPref()`; sie sind nicht Teil des Verlaufs.
 *
 * Neuzeichnen: Die Matrix ist ein gewöhnliches Objekt, das `Ops` direkt ändert. Das Signal
 * `revision` zählt jede Änderung; alle Komponenten lesen es und zeichnen dadurch neu (Preact
 * gleicht nur die Unterschiede im DOM ab, Fokus und Eingaben bleiben erhalten).
 */
import { signal } from '@preact/signals';
import { Examples } from '../examples.js';
import { Model } from '../model.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { toast } from './dom.js';
import { refreshLight, render, updateHistoryButtons } from './render-panels.jsx';
import { Util } from '../util.js';

/** Zähler für Änderungen an Matrix und Ansicht; Komponenten lesen ihn, um neu zu zeichnen. */
export const revision = signal(0);

const HISTORY_LIMIT = 200;
/** @type {TabPrefs} */
export const DEFAULT_PREFS = { mode: 'select', lines: 'active', compareOpen: true, compareView: 'table', compareDiff: false, compareSort: 'order', compareHideConflicts: false };
/** Ansichtseinstellungen, die jeder App-Tab für sich behält (`lines` gilt für alle). */
const VIEW_KEYS = /** @type {const} */ (['mode', 'compareOpen', 'compareView', 'compareDiff', 'compareSort', 'compareHideConflicts', 'collapsed']);
export const CLOSED_LIMIT = 8;


/** @param {TabPrefs | Partial<TabView>} source @returns {Partial<TabView>} */
export const pickView = source => Object.fromEntries(VIEW_KEYS.filter(k => k in source).map(k => [k, source[k]]));

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
      || { id: Util.uid(), data: startExample() };
    list.push({ docId: doc.id, view: {}, state: doc.data });
  }
  return { list, active: active || list[0].docId, closed: (ws && Array.isArray(ws.closed)) ? ws.closed : [] };
}

/** Matrix für den allerersten Start: das erste Beispiel, sonst eine leere Matrix. */
function startExample() {
  try {
    return Examples.loadFirst();
  } catch (e) {
    console.warn('Erstes Beispiel ist ungültig:', Util.errorMessage(e));
    return Model.blankState();
  }
}

const initial = loadInitialTabs();
/** @type {AppTab[]} */
export const tabs = initial.list;
/** Zuletzt geschlossene Matrizen (IDs, neueste zuerst). @type {string[]} */
export let closedTabs = initial.closed;

// loadInitialTabs liefert immer mindestens einen Tab, jeweils mit geladener Matrix
const initialTab = tabs.find(t => t.docId === initial.active) || tabs[0];
export let docId = initialTab.docId;
/** @type {Matrix} */
export let state = /** @type {Matrix} */ (initialTab.state);
/** @type {TabPrefs} */
export const prefs = { ...Store.loadPrefs(DEFAULT_PREFS), ...initialTab.view };
/** `data-fid` des Felds, das nach dem nächsten Neuzeichnen den Fokus bekommt. @type {string | null} */
export let pendingFocus = null;
/** @param {string | null} fid */
export function setPendingFocus(fid) { pendingFocus = fid; }
/** Beim Drucken werden alle Kategorien ausgeklappt. */
export let printing = false;
/** @param {boolean} on */
export function setPrinting(on) { printing = on; }
/** @param {string[]} ids */
export function setClosedTabs(ids) { closedTabs = ids; }

export const activeConcept = () => state.concepts.find(c => c.id === state.activeConceptId) || null;
/** Betrag in der Währung der aktuellen Matrix. @param {number} n */
export const money = n => Util.formatMoney(n, state.settings.currency);

// ---------- Speichern ----------

/** @type {string | null} */
export let lastSaved = null;
/** Verzögerung beim Speichern während des Tippens (ms). */
const SAVE_DELAY = 300;
let saveTimer = 0;

/** Sofort speichern (und ein ausstehendes verzögertes Speichern erledigen). */
export function save() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  const json = JSON.stringify(state);
  if (json === lastSaved) return;
  lastSaved = json;
  if (!Store.writeDoc(docId, state)) toast(Texts.errors.storageFull);
}

/**
 * Speichern bündeln: Beim Tippen wird erst nach einer kurzen Pause geschrieben statt bei
 * jedem Tastendruck. `save()` (z. B. beim Verlassen des Felds, Tab-Wechsel, Verlassen der
 * Seite) schreibt einen ausstehenden Stand sofort.
 */
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, SAVE_DELAY);
}

/** Ausstehendes verzögertes Speichern sofort erledigen (no-op, wenn nichts aussteht). */
export function flushSave() {
  if (saveTimer) save();
}

/** Geöffnete Tabs, aktiven Tab und deren Ansichten merken. @param {{ tabOnly?: boolean }} [opts] */
export function saveWorkspace(opts) {
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
export function setPref(key, value) {
  prefs[key] = value;
  Store.savePrefs(prefs);
  saveWorkspace();
}

// ---------- Verlauf (Rückgängig / Wiederholen) – je App-Tab ----------

/** @type {string[]} */
export let undoStack = [];
/** @type {string[]} */
export let redoStack = [];
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
export function mutate(fn) {
  pushHistory(snapshot());
  fn(state);
  save();
  render();
}

export function undo() {
  const snap = undoStack.pop();
  if (snap == null) return;
  redoStack.push(snapshot());
  state = JSON.parse(snap);
  save();
  render();
}

export function redo() {
  const snap = redoStack.pop();
  if (snap == null) return;
  undoStack.push(snapshot());
  state = JSON.parse(snap);
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
export function bindField(el, apply, after = refreshLight) {
  el.addEventListener('focus', () => { el._snap = snapshot(); });
  el.addEventListener('input', () => {
    if (el._snap == null) el._snap = snapshot();
    apply(el.value);
    scheduleSave();
    after();
  });
  el.addEventListener('change', () => {
    flushSave();
    if (el._snap != null && el._snap !== snapshot()) pushHistory(el._snap);
    el._snap = snapshot();
  });
}

/** Stand vor der laufenden Eingabe je Feld (für den Verlaufseintrag beim Verlassen). @type {WeakMap<EventTarget, string>} */
const fieldSnaps = new WeakMap();

/**
 * Ereignisse eines Eingabefelds, das den Zustand beim Tippen ändert (JSX: `{...fieldProps(…)}`).
 * Gespeichert wird nach einer kurzen Pause, der Verlaufseintrag entsteht beim Verlassen.
 * @param {(value: string) => void} apply
 * @param {() => void} [after] nach jeder Eingabe (Standard: neu zeichnen)
 */
export function fieldProps(apply, after = refreshLight) {
  return {
    onFocus: (/** @type {Event} */ e) => { fieldSnaps.set(/** @type {EventTarget} */ (e.currentTarget), snapshot()); },
    onInput: (/** @type {Event} */ e) => {
      const el = /** @type {HTMLInputElement} */ (e.currentTarget);
      if (!fieldSnaps.has(el)) fieldSnaps.set(el, snapshot());
      apply(el.value);
      scheduleSave();
      after();
    },
    onChange: (/** @type {Event} */ e) => {
      const el = /** @type {EventTarget} */ (e.currentTarget);
      flushSave();
      const before = fieldSnaps.get(el);
      if (before != null && before !== snapshot()) pushHistory(before);
      fieldSnaps.set(el, snapshot());
    },
  };
}

/** Übernimmt den Stand, den ein anderer Browser-Tab für die aktive Matrix gespeichert hat. */
export function adoptExternalChange() {
  const doc = Store.readDoc(docId);
  if (!doc) return;
  state = doc.data;
  lastSaved = JSON.stringify(state);
  clearHistory(); // eigener Verlauf passt nicht mehr zum fremden Stand
  render();
}

// ---------- Ansicht ----------

/** @param {TabPrefs['mode']} mode */
export function setMode(mode) {
  setPref('mode', mode);
  render();
}

/** @param {string | null} cid */
export const collapseKey = cid => cid || Model.NO_CATEGORY;
/** @param {string | null} cid */
export const isCollapsed = cid => !printing && !!(prefs.collapsed && prefs.collapsed[collapseKey(cid)]);

/** @param {string | null} cid @param {boolean} value */
export function setCollapsed(cid, value) {
  const next = { ...(prefs.collapsed || {}) };
  if (value) next[collapseKey(cid)] = true;
  else delete next[collapseKey(cid)];
  setPref('collapsed', next);
}

/**
 * Stand eines Tab-Eintrags als aktiven Stand übernehmen (Tab-Wechsel, js/ui/tabs.js).
 * @param {AppTab} t
 */
export function setActiveDoc(t) {
  docId = t.docId;
  state = /** @type {Matrix} */ (t.state); // Tab-Einträge halten ihre Matrix immer bereit
  undoStack = t.undo || [];
  redoStack = t.redo || [];
  // `null` heißt „noch nie gespeichert“ (neuer Tab) – nicht mit „unbekannt“ verwechseln
  lastSaved = t.lastSaved !== undefined ? t.lastSaved : JSON.stringify(state);
}
