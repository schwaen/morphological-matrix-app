/*
 * Store – Speicherung im Browser.
 * Jede Matrix liegt unter einem eigenen Schlüssel im localStorage. Welche Matrix ein Tab
 * bearbeitet und wie er sie anzeigt, steht im sessionStorage des Tabs – so arbeiten
 * mehrere Tabs unabhängig. Stellt den globalen Namensraum `Store` bereit.
 */
'use strict';

const Store = (() => {
  const DOC_PREFIX = 'morphologische-matrix:doc:';
  const LEGACY_KEY = 'morphologische-matrix:v1';
  const TAB_DOC_KEY = 'morphologische-matrix:tab-doc';
  const PREFS_KEY = 'morphologische-matrix:prefs';
  const WORKSPACE_KEY = 'morphologische-matrix:workspace';

  /** @typedef {'localStorage' | 'sessionStorage'} Area */

  // Web Storage kann fehlen oder gesperrt sein (z. B. privates Fenster) – dann leere Werte.
  /** @param {Area} area @param {string} key @returns {string | null} */
  function get(area, key) {
    try { return window[area].getItem(key); } catch (e) { return null; }
  }
  /** @param {Area} area @param {string} key @param {string} value @returns {boolean} */
  function set(area, key, value) {
    try { window[area].setItem(key, value); return true; } catch (e) { return false; }
  }
  /** @param {Area} area @param {string} key */
  function remove(area, key) {
    try { window[area].removeItem(key); } catch (e) { /* ignorieren */ }
  }

  /** @typedef {{ id: string, savedAt: number, data: Matrix }} StoredDoc */

  /** @param {string} id @returns {StoredDoc | null} */
  function readDoc(id) {
    try {
      const raw = get('localStorage', DOC_PREFIX + id);
      if (!raw) return null;
      const rec = JSON.parse(raw);
      return { id, savedAt: Number(rec.savedAt) || 0, data: Model.normalize(rec.data) };
    } catch (e) {
      return null;
    }
  }

  /** @param {string} id @param {Matrix} data @returns {boolean} */
  /** @param {string} id @param {Matrix} data @param {number} [savedAt] z. B. beim Wiederherstellen eines Backups */
  function writeDoc(id, data, savedAt = Date.now()) {
    return set('localStorage', DOC_PREFIX + id, JSON.stringify({ savedAt, data }));
  }

  /** @param {string} id */
  const removeDoc = id => remove('localStorage', DOC_PREFIX + id);

  /** Matrix-ID zu einem Speicherschlüssel (z. B. aus einem `storage`-Ereignis), sonst `null`. @param {string | null} key */
  const docIdFromKey = key => (key && key.startsWith(DOC_PREFIX) ? key.slice(DOC_PREFIX.length) : null);

  /** Alle gespeicherten Matrizen, zuletzt bearbeitete zuerst. @returns {StoredDoc[]} */
  function listDocs() {
    const docs = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(DOC_PREFIX)) {
          const doc = readDoc(key.slice(DOC_PREFIX.length));
          if (doc) docs.push(doc);
        }
      }
    } catch (e) { /* Speicher nicht verfügbar */ }
    return docs.sort((a, b) => b.savedAt - a.savedAt);
  }

  /** Übernimmt die Daten aus der Version mit nur einer gespeicherten Matrix. */
  function migrateLegacy() {
    const raw = get('localStorage', LEGACY_KEY);
    if (!raw) return;
    try {
      if (writeDoc(Util.uid(), Model.normalize(JSON.parse(raw)))) remove('localStorage', LEGACY_KEY);
    } catch (e) {
      remove('localStorage', LEGACY_KEY);
    }
  }

  /** ID der Matrix, die dieser Browser-Tab vor Einführung der App-Tabs bearbeitet hat. */
  const legacyTabDocId = () => get('sessionStorage', TAB_DOC_KEY) || '';

  /**
   * Geöffnete App-Tabs: die dieses Browser-Tabs, für neue Browser-Tabs die zuletzt verwendeten.
   * @returns {Workspace | null}
   */
  function loadWorkspace() {
    const raw = get('sessionStorage', WORKSPACE_KEY) || get('localStorage', WORKSPACE_KEY);
    try {
      const ws = JSON.parse(raw || 'null');
      return ws && Array.isArray(ws.tabs) ? ws : null;
    } catch (e) {
      return null;
    }
  }

  /** @param {Workspace} ws @param {{ tabOnly?: boolean }} [opts] */
  function saveWorkspace(ws, { tabOnly = false } = {}) {
    const json = JSON.stringify(ws);
    set('sessionStorage', WORKSPACE_KEY, json);
    if (!tabOnly) set('localStorage', WORKSPACE_KEY, json);
  }

  /**
   * Eigene Einstellungen des Tabs, für neue Tabs die zuletzt verwendeten.
   * @param {TabPrefs} defaults
   * @returns {TabPrefs}
   */
  function loadPrefs(defaults) {
    const raw = get('sessionStorage', PREFS_KEY) || get('localStorage', PREFS_KEY);
    try {
      return { ...defaults, ...JSON.parse(raw || '{}') };
    } catch (e) {
      return { ...defaults };
    }
  }

  /**
   * @param {TabPrefs} prefs
   * @param {{ tabOnly?: boolean }} [opts] `tabOnly`: nicht als Vorgabe für neue Tabs merken
   */
  function savePrefs(prefs, { tabOnly = false } = {}) {
    const json = JSON.stringify(prefs);
    set('sessionStorage', PREFS_KEY, json);
    if (!tabOnly) set('localStorage', PREFS_KEY, json);
  }

  return {
    readDoc, writeDoc, removeDoc, docIdFromKey, listDocs, migrateLegacy,
    legacyTabDocId, loadWorkspace, saveWorkspace, loadPrefs, savePrefs,
  };
})();
