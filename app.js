/*
 * Morphologische Matrix – reine Browser-App ohne Build-Schritt.
 * Datenmodell:
 *   state = {
 *     version, title, description,
 *     parameters: [{ id, name, options: [{ id, text }] }],
 *     concepts:   [{ id, name, color, selections: { [parameterId]: optionId } }],
 *     activeConceptId
 *   }
 */
(() => {
  'use strict';

  // Jede Matrix liegt unter einem eigenen Schlüssel im localStorage. Welche Matrix
  // ein Tab bearbeitet und wie er sie anzeigt, steht im sessionStorage des Tabs –
  // so können mehrere Tabs unabhängig voneinander an verschiedenen Matrizen arbeiten.
  const DOC_PREFIX = 'morphologische-matrix:doc:';
  const LEGACY_KEY = 'morphologische-matrix:v1';
  const TAB_DOC_KEY = 'morphologische-matrix:tab-doc';
  const PREFS_KEY = 'morphologische-matrix:prefs';
  const HISTORY_LIMIT = 200;
  const COLORS = ['#e8590c', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#e03131', '#0c8599', '#f08c00', '#5f3dc4'];

  const ICONS = {
    up: 'M6 15l6-6 6 6',
    left: 'M15 6l-6 6 6 6',
    right: 'M9 6l6 6-6 6',
    down: 'M6 9l6 6 6-6',
    trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
    x: 'M6 6l12 12M18 6L6 18',
    plus: 'M12 5v14M5 12h14',
    copy: 'M9 9h10v10H9zM5 15V5h10',
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------- Hilfsfunktionen ----------

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs || {})) {
      if (val == null || val === false) continue;
      if (key === 'class') el.className = val;
      else if (key === 'value') el.value = val;
      else if (key === 'style') for (const [p, v] of Object.entries(val)) el.style.setProperty(p, v);
      else if (key === 'dataset') Object.assign(el.dataset, val);
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), val);
      else el.setAttribute(key, val === true ? '' : val);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      el.append(child instanceof Node ? child : String(child));
    }
    return el;
  }

  function icon(name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.append(path);
    return svg;
  }

  function iconBtn(name, label, onclick, { disabled = false, danger = false, small = true } = {}) {
    return h('button', {
      type: 'button',
      class: `icon-btn${small ? ' small' : ''}${danger ? ' danger' : ''}`,
      title: label,
      'aria-label': label,
      disabled,
      onclick,
    }, icon(name));
  }

  function str(v, fallback = '') {
    return typeof v === 'string' ? v : (v == null ? fallback : String(v));
  }

  const CATEGORY_COLORS = ['#4f46e5', '#0891b2', '#d97706', '#059669', '#db2777', '#7c3aed', '#475569', '#65a30d'];
  const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP'];
  const SCALES = [5, 10, 100];
  const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

  function defaultSettings() {
    return { costs: false, utility: false, currency: 'EUR', utilityMax: 10 };
  }

  function num(v) {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }

  /** Liest Zahlen in deutscher oder englischer Schreibweise („1.200,50“, „1200.5“). Ungültig → NaN. */
  function parseNumber(text) {
    let s = String(text).trim().replace(/[\s€$£]|CHF/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
  }

  function numberToInput(n) {
    return n == null ? '' : String(n).replace('.', ',');
  }

  function formatMoney(n) {
    try {
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: state.settings.currency }).format(n);
    } catch (e) {
      return `${numberFormat.format(n)} ${state.settings.currency}`;
    }
  }

  function isColor(v) {
    return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  }

  function nextColor(concepts) {
    const used = new Set(concepts.map(c => c.color.toLowerCase()));
    return COLORS.find(c => !used.has(c)) || COLORS[concepts.length % COLORS.length];
  }

  function slugify(text) {
    return (text || 'matrix')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .toLowerCase().slice(0, 60) || 'matrix';
  }

  // ---------- Zustand ----------

  function newOption() {
    return { id: uid(), text: '', cost: null, score: null };
  }

  function blankState() {
    const parameters = [1, 2, 3].map(i => ({
      id: uid(),
      name: `Parameter ${i}`,
      weight: null,
      categoryId: null,
      options: [newOption(), newOption()],
    }));
    const concept = { id: uid(), name: 'Konzept 1', color: COLORS[0], selections: {} };
    return {
      version: 1,
      title: 'Neue morphologische Matrix',
      description: '',
      settings: defaultSettings(),
      categories: [],
      parameters,
      concepts: [concept],
      activeConceptId: concept.id,
    };
  }

  function exampleState() {
    // [Parameter, Gewicht, [[Ausprägung, Kosten, Nutzwert 0–10], …]]
    const rows = [
      ['Wassererwärmung', 3, [['Durchlauferhitzer', 18, 6], ['Boiler', 25, 5], ['Thermoblock', 22, 8], ['Induktion', 40, 9]]],
      ['Druckerzeugung', 3, [['Schwerkraft', 2, 3], ['Vibrationspumpe', 12, 7], ['Rotationspumpe', 45, 9], ['Handhebel', 8, 6]]],
      ['Kaffeezufuhr', 2, [['Pulver (lose)', 3, 6], ['Kapsel', 10, 8], ['Pad', 6, 5], ['Bohnen mit Mahlwerk', 35, 9]]],
      ['Bedienung', 1, [['Drehknopf', 2, 5], ['Tasten', 4, 6], ['Touch-Display', 20, 8], ['Smartphone-App', 15, 7]]],
      ['Energieversorgung', 2, [['Netzstrom', 3, 8], ['Akku', 30, 6], ['Gaskartusche', 15, 5], ['Muskelkraft', 1, 3]]],
      ['Reinigung', 1, [['Manuell', 0, 3], ['Automatische Spülung', 10, 8], ['Spülmaschinenfest', 5, 7]]],
    ];
    const categories = [
      { id: uid(), name: 'Brühsystem', color: CATEGORY_COLORS[0] },
      { id: uid(), name: 'Nutzung & Betrieb', color: CATEGORY_COLORS[1] },
    ];
    const parameters = rows.map(([name, weight, opts], i) => ({
      id: uid(),
      name,
      weight,
      categoryId: categories[i < 3 ? 0 : 1].id,
      options: opts.map(([text, cost, score]) => ({ id: uid(), text, cost, score })),
    }));
    const pick = idx => Object.fromEntries(parameters.map((p, i) => [p.id, p.options[idx[i]].id]));
    const concepts = [
      { id: uid(), name: 'Kompakt-Espresso', color: COLORS[0], selections: pick([2, 1, 0, 1, 0, 1]) },
      { id: uid(), name: 'Outdoor', color: COLORS[1], selections: pick([3, 3, 2, 0, 3, 0]) },
      { id: uid(), name: 'Smart Home', color: COLORS[2], selections: pick([1, 2, 3, 3, 0, 1]) },
    ];
    return {
      version: 1,
      title: 'Beispiel: Kaffeemaschine',
      description: 'Gesamtfunktion: Aus Wasser und Kaffee ein heißes Getränk zubereiten.',
      // Kosten und Nutzwerte sind hinterlegt, aber zunächst ausgeblendet.
      settings: defaultSettings(),
      categories,
      parameters,
      concepts,
      activeConceptId: concepts[0].id,
    };
  }

  /** Prüft und bereinigt beliebige (z. B. importierte) Daten. Wirft bei unbrauchbarem Format. */
  function normalize(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.parameters)) {
      throw new Error('Ungültiges Dateiformat: „parameters“ fehlt.');
    }
    const seen = new Set();
    const id = v => {
      let s = str(v);
      if (!s || seen.has(s)) s = uid();
      seen.add(s);
      return s;
    };
    const parameters = data.parameters.map(p => {
      const weight = num(p && p.weight);
      return {
        id: id(p && p.id),
        name: str(p && p.name),
        weight: weight != null && weight >= 0 ? weight : null,
        categoryId: str(p && p.categoryId) || null,
        options: (Array.isArray(p && p.options) ? p.options : []).map(o =>
          typeof o === 'string'
            ? { id: id(), text: o, cost: null, score: null }
            : { id: id(o && o.id), text: str(o && o.text), cost: num(o && o.cost), score: num(o && o.score) }),
      };
    });
    const categories = (Array.isArray(data.categories) ? data.categories : []).map((k, i) => ({
      id: id(k && k.id),
      name: str(k && k.name),
      color: isColor(k && k.color) ? k.color : CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
    for (const p of parameters) {
      if (!categories.some(k => k.id === p.categoryId)) p.categoryId = null;
    }
    const src = (data.settings && typeof data.settings === 'object') ? data.settings : {};
    const settings = {
      costs: src.costs === true,
      utility: src.utility === true,
      currency: CURRENCIES.includes(src.currency) ? src.currency : 'EUR',
      utilityMax: SCALES.includes(src.utilityMax) ? src.utilityMax : 10,
    };
    const concepts = (Array.isArray(data.concepts) ? data.concepts : []).map((c, i, all) => {
      const selections = {};
      const src = (c && c.selections) || {};
      for (const p of parameters) {
        const oid = str(src[p.id]);
        if (oid && p.options.some(o => o.id === oid)) selections[p.id] = oid;
      }
      return {
        id: id(c && c.id),
        name: str(c && c.name, `Konzept ${i + 1}`),
        color: isColor(c && c.color) ? c.color : COLORS[i % COLORS.length],
        selections,
      };
    });
    const activeConceptId = concepts.some(c => c.id === data.activeConceptId)
      ? data.activeConceptId
      : (concepts[0] ? concepts[0].id : null);
    return {
      version: 1,
      title: str(data.title, 'Morphologische Matrix'),
      description: str(data.description),
      settings,
      categories,
      parameters: sortedByCategory(categories, parameters),
      concepts,
      activeConceptId,
    };
  }

  /**
   * Parameter nach Kategorien gruppiert sortieren (Reihenfolge der Kategorien, ohne
   * Kategorie zuletzt; innerhalb einer Gruppe stabil). So entspricht die Reihenfolge
   * im Array immer der Anzeige – Linien, Vergleich und Export brauchen keine Sonderfälle.
   */
  function sortedByCategory(categories, parameters) {
    const rank = new Map(categories.map((k, i) => [k.id, i]));
    const r = p => (rank.has(p.categoryId) ? rank.get(p.categoryId) : categories.length);
    return parameters.map((p, i) => ({ p, i }))
      .sort((a, b) => r(a.p) - r(b.p) || a.i - b.i)
      .map(x => x.p);
  }

  function resort(s) {
    s.parameters = sortedByCategory(s.categories, s.parameters);
  }

  // ---------- Speicher ----------

  const storage = {
    get(area, key) {
      try { return window[area].getItem(key); } catch (e) { return null; }
    },
    set(area, key, value) {
      try { window[area].setItem(key, value); return true; } catch (e) { return false; }
    },
    remove(area, key) {
      try { window[area].removeItem(key); } catch (e) { /* ignorieren */ }
    },
  };

  function readDoc(id) {
    try {
      const raw = storage.get('localStorage', DOC_PREFIX + id);
      if (!raw) return null;
      const rec = JSON.parse(raw);
      return { id, savedAt: Number(rec.savedAt) || 0, data: normalize(rec.data) };
    } catch (e) {
      return null;
    }
  }

  /** Alle gespeicherten Matrizen, zuletzt bearbeitete zuerst. */
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
    const raw = storage.get('localStorage', LEGACY_KEY);
    if (!raw) return;
    try {
      const data = normalize(JSON.parse(raw));
      if (storage.set('localStorage', DOC_PREFIX + uid(), JSON.stringify({ savedAt: Date.now(), data }))) {
        storage.remove('localStorage', LEGACY_KEY);
      }
    } catch (e) {
      storage.remove('localStorage', LEGACY_KEY);
    }
  }

  /** Matrix für diesen Tab: die zuletzt hier geöffnete, sonst die zuletzt bearbeitete. */
  function loadInitialDoc() {
    migrateLegacy();
    const params = new URLSearchParams(location.search);
    const requested = params.get('doc');
    if (requested != null) {
      // Parameter entfernen, damit ein späteres Neuladen die aktuelle Tab-Matrix zeigt.
      params.delete('doc');
      const query = params.toString();
      history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
      const doc = readDoc(requested);
      if (doc) return doc;
    }
    const tabDoc = readDoc(storage.get('sessionStorage', TAB_DOC_KEY) || '');
    if (tabDoc) return tabDoc;
    const [latest] = listDocs();
    if (latest) return latest;
    return { id: uid(), data: exampleState() };
  }

  function loadPrefs() {
    const defaults = { mode: 'select', showLines: true, compareOpen: true };
    // Eigene Einstellungen des Tabs, für neue Tabs die zuletzt verwendeten.
    const raw = storage.get('sessionStorage', PREFS_KEY) || storage.get('localStorage', PREFS_KEY);
    try {
      return { ...defaults, ...JSON.parse(raw || '{}') };
    } catch (e) {
      return defaults;
    }
  }

  let lastSaved = null;
  function save() {
    const json = JSON.stringify(state);
    if (json === lastSaved) return;
    lastSaved = json;
    storage.set('sessionStorage', TAB_DOC_KEY, docId);
    if (!storage.set('localStorage', DOC_PREFIX + docId, JSON.stringify({ savedAt: Date.now(), data: state }))) {
      toast('Speichern im Browser nicht möglich – bitte als JSON sichern.');
    }
  }

  function savePrefs() {
    const json = JSON.stringify(prefs);
    storage.set('sessionStorage', PREFS_KEY, json);
    storage.set('localStorage', PREFS_KEY, json);
  }

  const initialDoc = loadInitialDoc();
  let docId = initialDoc.id;
  let state = initialDoc.data;
  const prefs = loadPrefs();
  let pendingFocus = null;

  const activeConcept = () => state.concepts.find(c => c.id === state.activeConceptId) || null;

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

  /** Strukturelle Änderung: Verlauf sichern, ändern, speichern, neu zeichnen. */
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

  function updateHistoryButtons() {
    $('#undoBtn').disabled = !undoStack.length;
    $('#redoBtn').disabled = !redoStack.length;
  }

  /**
   * Bindet ein Textfeld an den Zustand, ohne beim Tippen neu zu rendern
   * (sonst ginge der Fokus verloren). Der Verlaufseintrag entsteht beim Verlassen.
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

  // ---------- Aktionen ----------

  function addParameter(categoryId = null) {
    const p = { id: uid(), name: '', weight: null, categoryId, options: [newOption(), newOption()] };
    pendingFocus = `param:${p.id}`;
    if (categoryId) setCollapsed(categoryId, false);
    mutate(s => {
      s.parameters.push(p);
      resort(s);
    });
  }

  /** Nur innerhalb der eigenen Kategorie verschiebbar. */
  function canMoveParameter(index, delta) {
    const p = state.parameters[index];
    const q = state.parameters[index + delta];
    return !!q && q.categoryId === p.categoryId;
  }

  // ---------- Kategorien ----------

  const categoryById = id => state.categories.find(k => k.id === id) || null;

  /** Parametergruppen in Anzeigereihenfolge; ohne Kategorien genau eine Gruppe ohne Kopfzeile. */
  function categoryGroups() {
    const groups = state.categories.map(cat => ({ cat, items: [] }));
    const none = { cat: null, items: [] };
    state.parameters.forEach((p, pi) => {
      const g = groups.find(x => x.cat.id === p.categoryId) || none;
      g.items.push({ p, pi });
    });
    if (none.items.length || !groups.length) groups.push(none);
    return groups;
  }

  let printing = false;
  const isCollapsed = cid => !printing && !!(prefs.collapsed && prefs.collapsed[cid || '__none']);

  function setCollapsed(cid, value) {
    prefs.collapsed = { ...(prefs.collapsed || {}) };
    if (value) prefs.collapsed[cid || '__none'] = true;
    else delete prefs.collapsed[cid || '__none'];
    savePrefs();
  }

  function toggleCategory(cid) {
    setCollapsed(cid, !isCollapsed(cid));
    renderMatrix();
    renderCategoryNav();
    scheduleLines();
  }

  function setAllCollapsed(value) {
    for (const g of categoryGroups()) setCollapsed(g.cat ? g.cat.id : null, value);
    renderMatrix();
    renderCategoryNav();
    scheduleLines();
  }

  function jumpToCategory(cid) {
    if (isCollapsed(cid)) toggleCategory(cid);
    const band = document.querySelector(`[data-cat-band="${CSS.escape(cid || '__none')}"]`);
    if (band) band.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function addCategory() {
    const used = new Set(state.categories.map(k => k.color));
    const k = {
      id: uid(),
      name: `Kategorie ${state.categories.length + 1}`,
      color: CATEGORY_COLORS.find(c => !used.has(c)) || CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length],
    };
    pendingFocus = `cat:${k.id}`;
    if (prefs.mode !== 'edit') {
      prefs.mode = 'edit';
      savePrefs();
    }
    mutate(s => { s.categories.push(k); });
    return k;
  }

  function moveCategory(index, delta) {
    mutate(s => {
      const [k] = s.categories.splice(index, 1);
      s.categories.splice(index + delta, 0, k);
      resort(s);
    });
  }

  function deleteCategory(cid) {
    const k = categoryById(cid);
    mutate(s => {
      s.categories = s.categories.filter(x => x.id !== cid);
      s.parameters.forEach(p => { if (p.categoryId === cid) p.categoryId = null; });
      resort(s);
    });
    toast(`Kategorie „${(k && k.name) || 'Unbenannt'}“ gelöscht – ihre Parameter bleiben erhalten.`, true);
  }

  function setParameterCategory(pid, cid) {
    if (cid === '__new') {
      const name = window.prompt('Name der neuen Kategorie:', `Kategorie ${state.categories.length + 1}`);
      if (name == null) { renderMatrix(); return; }
      const used = new Set(state.categories.map(k => k.color));
      const k = { id: uid(), name: name.trim(), color: CATEGORY_COLORS.find(c => !used.has(c)) || CATEGORY_COLORS[0] };
      mutate(s => {
        s.categories.push(k);
        s.parameters.find(p => p.id === pid).categoryId = k.id;
        resort(s);
      });
      return;
    }
    if (cid) setCollapsed(cid, false);
    mutate(s => {
      s.parameters.find(p => p.id === pid).categoryId = cid || null;
      resort(s);
    });
  }

  function moveParameter(index, delta) {
    mutate(s => {
      const [p] = s.parameters.splice(index, 1);
      s.parameters.splice(index + delta, 0, p);
    });
  }

  function deleteParameter(pid) {
    const p = state.parameters.find(x => x.id === pid);
    mutate(s => {
      s.parameters = s.parameters.filter(x => x.id !== pid);
      s.concepts.forEach(c => { delete c.selections[pid]; });
    });
    toast(`Parameter „${p.name || 'Unbenannt'}“ gelöscht.`, true);
  }

  function addOption(pid, afterIndex) {
    const o = newOption();
    pendingFocus = `opt:${o.id}`;
    mutate(s => {
      const p = s.parameters.find(x => x.id === pid);
      const at = afterIndex == null ? p.options.length : afterIndex + 1;
      p.options.splice(at, 0, o);
    });
  }

  /** Ausprägung innerhalb ihres Parameters nach links (−1) oder rechts (+1) verschieben. */
  function moveOption(pid, index, delta) {
    const p = state.parameters.find(x => x.id === pid);
    const target = index + delta;
    if (!p || target < 0 || target >= p.options.length) return;
    pendingFocus = document.activeElement && document.activeElement.dataset.fid === `opt:${p.options[index].id}`
      ? `opt:${p.options[index].id}` : null;
    mutate(s => {
      const opts = s.parameters.find(x => x.id === pid).options;
      const [o] = opts.splice(index, 1);
      opts.splice(target, 0, o);
    });
  }

  function deleteOption(pid, oid) {
    mutate(s => {
      const p = s.parameters.find(x => x.id === pid);
      p.options = p.options.filter(o => o.id !== oid);
      s.concepts.forEach(c => { if (c.selections[pid] === oid) delete c.selections[pid]; });
    });
  }

  function toggleSelection(pid, oid) {
    mutate(s => {
      let c = s.concepts.find(x => x.id === s.activeConceptId);
      if (!c) {
        c = { id: uid(), name: `Konzept ${s.concepts.length + 1}`, color: nextColor(s.concepts), selections: {} };
        s.concepts.push(c);
        s.activeConceptId = c.id;
      }
      if (c.selections[pid] === oid) delete c.selections[pid];
      else c.selections[pid] = oid;
    });
  }

  function addConcept() {
    const c = { id: uid(), name: `Konzept ${state.concepts.length + 1}`, color: nextColor(state.concepts), selections: {} };
    mutate(s => {
      s.concepts.push(c);
      s.activeConceptId = c.id;
    });
    if (prefs.mode !== 'select') setMode('select');
  }

  function duplicateConcept(cid) {
    mutate(s => {
      const idx = s.concepts.findIndex(x => x.id === cid);
      const src = s.concepts[idx];
      const copy = { id: uid(), name: `${src.name} (Kopie)`, color: nextColor(s.concepts), selections: { ...src.selections } };
      s.concepts.splice(idx + 1, 0, copy);
      s.activeConceptId = copy.id;
    });
  }

  function deleteConcept(cid) {
    const c = state.concepts.find(x => x.id === cid);
    mutate(s => {
      const idx = s.concepts.findIndex(x => x.id === cid);
      s.concepts.splice(idx, 1);
      if (s.activeConceptId === cid) {
        const next = s.concepts[Math.min(idx, s.concepts.length - 1)];
        s.activeConceptId = next ? next.id : null;
      }
    });
    toast(`Konzept „${c.name || 'Unbenannt'}“ gelöscht.`, true);
  }

  function setActiveConcept(cid) {
    if (state.activeConceptId === cid) return;
    state.activeConceptId = cid;
    save();
    render();
  }

  function randomizeActive() {
    if (!state.parameters.some(p => p.options.length)) {
      toast('Es gibt noch keine Ausprägungen.');
      return;
    }
    mutate(s => {
      let c = s.concepts.find(x => x.id === s.activeConceptId);
      if (!c) {
        c = { id: uid(), name: `Konzept ${s.concepts.length + 1}`, color: nextColor(s.concepts), selections: {} };
        s.concepts.push(c);
        s.activeConceptId = c.id;
      }
      c.selections = {};
      for (const p of s.parameters) {
        if (p.options.length) c.selections[p.id] = p.options[Math.floor(Math.random() * p.options.length)].id;
      }
    });
    if (prefs.mode !== 'select') setMode('select');
  }

  // ---------- Automatische Konzepte ----------

  function lexLess(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return true;
      if (a[i] > b[i]) return false;
    }
    return false;
  }

  /** Wählt die Ausprägung mit dem lexikografisch kleinsten Schlüssel; Kandidaten per Filter. */
  function pickBy(p, filter, key) {
    let best = null;
    let bestKey = null;
    for (const o of p.options) {
      if (!filter(o)) continue;
      const k = key(o);
      if (!best || lexLess(k, bestKey)) { best = o; bestKey = k; }
    }
    return best;
  }

  const hasScore = o => o.score != null;
  const hasCost = o => o.cost != null;
  // Nebenkriterien bei Gleichstand (nur wenn die jeweilige Bewertung aktiv ist)
  const tieCost = o => (state.settings.costs && hasCost(o) ? o.cost : Infinity);
  const tieScore = o => (state.settings.utility && hasScore(o) ? -clampScore(o.score) : Infinity);

  /** Je Parameter unabhängig wählen – exakt für Summenkriterien (Kosten, gewichteter Nutzwert). */
  function separable(filter, key) {
    return () => {
      const selections = {};
      let skipped = 0;
      for (const p of state.parameters) {
        const o = pickBy(p, filter, key);
        if (o) selections[p.id] = o.id;
        else skipped++;
      }
      return { selections, skipped };
    };
  }

  /**
   * Bestes Preis-Leistungs-Verhältnis (minimale Kosten je Nutzwertpunkt).
   * Der Quotient ist nicht je Parameter zerlegbar; das Dinkelbach-Verfahren löst ihn
   * exakt über eine Folge zerlegbarer Probleme min Σ (Kosten − λ · Nutzwertanteil).
   */
  function buildBestValue() {
    const W = totalWeight();
    const cands = state.parameters.map(p => p.options.filter(o => hasCost(o) && hasScore(o)));
    if (!state.parameters.length || cands.some(list => !list.length)) {
      return { error: 'Dafür müssen in jedem Parameter Ausprägungen mit Kosten und Nutzwert gepflegt sein.' };
    }
    if (W <= 0) return { error: 'Die Summe der Gewichte ist 0.' };
    const util = (p, o) => (weightOf(p) * clampScore(o.score)) / W;
    const solve = objective => state.parameters.map((p, i) => cands[i].reduce((best, o) => {
      const d = objective(p, o) - objective(p, best);
      return d < -1e-12 || (Math.abs(d) <= 1e-12 && util(p, o) > util(p, best)) ? o : best;
    }));
    const totals = xs => xs.reduce((t, o, i) => ({ C: t.C + o.cost, U: t.U + util(state.parameters[i], o) }), { C: 0, U: 0 });

    // Start: höchster Nutzwert
    let x = solve((p, o) => -util(p, o));
    let { C, U } = totals(x);
    if (U <= 0) return { error: 'Alle gepflegten Nutzwerte sind 0.' };
    let lambda = C / U;
    for (let iter = 0; iter < 100; iter++) {
      const next = solve((p, o) => o.cost - lambda * util(p, o));
      const t = totals(next);
      if (t.U <= 0 || t.C - lambda * t.U >= -1e-9) break;
      x = next;
      lambda = t.C / t.U;
    }
    return { selections: Object.fromEntries(state.parameters.map((p, i) => [p.id, x[i].id])), skipped: 0 };
  }

  /** Strategien zum automatischen Erstellen eines Konzepts; Reihenfolge = Reihenfolge der Knöpfe. */
  const GENERATORS = {
    'max-utility': {
      label: 'Höchster Nutzwert',
      available: () => state.settings.utility,
      missing: 'Nutzwert',
      build: separable(hasScore, o => [-clampScore(o.score), tieCost(o)]),
    },
    'min-utility': {
      label: 'Geringster Nutzwert',
      available: () => state.settings.utility,
      missing: 'Nutzwert',
      build: separable(hasScore, o => [clampScore(o.score), tieCost(o)]),
    },
    'min-cost': {
      label: 'Geringste Kosten',
      available: () => state.settings.costs,
      missing: 'Kosten',
      build: separable(hasCost, o => [o.cost, tieScore(o)]),
    },
    'max-cost': {
      label: 'Höchste Kosten',
      available: () => state.settings.costs,
      missing: 'Kosten',
      build: separable(hasCost, o => [-o.cost, tieScore(o)]),
    },
    'best-value': {
      label: 'Beste Preis-Leistung',
      available: () => state.settings.costs && state.settings.utility,
      missing: 'Kosten und Nutzwert',
      build: buildBestValue,
    },
  };

  function sameSelections(a, b) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]);
  }

  function uniqueConceptName(base) {
    const names = new Set(state.concepts.map(c => c.name));
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }

  function generateConcept(key) {
    const gen = GENERATORS[key];
    if (!gen || !gen.available()) return;
    const { selections, skipped, error } = gen.build();
    if (error || !Object.keys(selections).length) {
      toast(`Kein Konzept erstellt. ${error || `Bitte zuerst ${gen.missing} an den Ausprägungen erfassen.`}`);
      return;
    }
    const existing = state.concepts.find(c => sameSelections(c.selections, selections));
    if (existing) {
      setActiveConcept(existing.id);
      if (prefs.mode !== 'select') setMode('select');
      toast(`Diese Kombination („${gen.label}“) gibt es bereits als Konzept „${existing.name || 'Unbenannt'}“ – es wurde ausgewählt.`);
      return;
    }
    const c = { id: uid(), name: uniqueConceptName(gen.label), color: nextColor(state.concepts), selections };
    mutate(s => {
      s.concepts.push(c);
      s.activeConceptId = c.id;
    });
    if (prefs.mode !== 'select') setMode('select');
    toast(skipped
      ? `Konzept „${c.name}“ erstellt – ${skipped} ${skipped === 1 ? 'Parameter blieb' : 'Parameter blieben'} ohne Auswahl, da dort ${gen.missing} fehlt.`
      : `Konzept „${c.name}“ erstellt.`, true);
  }

  function renderGenerators() {
    let any = false;
    document.querySelectorAll('[data-generate]').forEach(btn => {
      const gen = GENERATORS[btn.dataset.generate];
      const on = !!gen && gen.available();
      btn.hidden = !on;
      any = any || on;
    });
    $('#autoConcepts').hidden = !any;
  }

  function clearActive() {
    const c = activeConcept();
    if (!c || !Object.keys(c.selections).length) return;
    mutate(s => { s.concepts.find(x => x.id === s.activeConceptId).selections = {}; });
  }

  /** Öffnet in diesem Tab eine andere Matrix; andere Tabs bleiben unberührt. */
  function openDoc(id, data, message) {
    docId = id;
    state = data;
    lastSaved = null;
    undoStack.length = 0;
    redoStack.length = 0;
    save();
    render();
    if (message) toast(message);
  }

  /** Legt eine neue Matrix an und öffnet sie in diesem Tab. */
  function openNewDoc(data, message) {
    openDoc(uid(), data, message);
  }

  function setMode(mode) {
    prefs.mode = mode;
    savePrefs();
    render();
  }

  // ---------- Rendern ----------

  function render() {
    document.title = state.title ? `${state.title} – Morphologische Matrix` : 'Morphologische Matrix';
    const title = $('#title');
    if (document.activeElement !== title) title.value = state.title;
    const desc = $('#description');
    if (document.activeElement !== desc) desc.value = state.description;

    document.querySelectorAll('.segmented button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === prefs.mode));
    });
    $('#showLines').checked = prefs.showLines;
    $('#addParamBtn').hidden = prefs.mode !== 'edit';
    $('#addCategoryBtn').hidden = prefs.mode !== 'edit';

    renderMatrix();
    renderCategoryNav();
    renderConcepts();
    renderGenerators();
    refreshLight();
    syncSettingsForm();
    updateHistoryButtons();
    autosizeAll();
    applyPendingFocus();
  }

  /** Leichte Aktualisierung ohne Eingabefelder neu zu erzeugen. */
  function refreshLight() {
    updateWeightPercents();
    renderCategoryNav();
    renderStats();
    renderHint();
    renderSummary();
    renderCompare();
    updateProgress();
    scheduleLines();
  }

  function renderStats() {
    const P = state.parameters.length;
    const O = state.parameters.reduce((n, p) => n + p.options.length, 0);
    const combos = P ? state.parameters.reduce((n, p) => n * BigInt(p.options.length), 1n) : 0n;
    const stat = (value, label) => h('span', { class: 'stat' }, h('strong', null, value), ` ${label}`);
    $('#stats').replaceChildren(
      stat(P.toLocaleString('de-DE'), 'Parameter'),
      stat(O.toLocaleString('de-DE'), O === 1 ? 'Ausprägung' : 'Ausprägungen'),
      stat(combos.toLocaleString('de-DE'), combos === 1n ? 'mögliche Kombination' : 'mögliche Kombinationen'),
      stat(state.concepts.length.toLocaleString('de-DE'), state.concepts.length === 1 ? 'Konzept' : 'Konzepte'),
    );
  }

  function renderHint() {
    const c = activeConcept();
    $('#hint').textContent = prefs.mode === 'edit'
      ? 'Tipp: Mit Enter springen Sie zur nächsten Ausprägung bzw. legen eine neue an. Zum Kombinieren oben auf „Kombinieren“ wechseln.'
      : (c
        ? `Klicken Sie je Parameter auf eine Ausprägung, um sie dem Konzept „${c.name || 'Unbenannt'}“ zuzuordnen. Erneuter Klick hebt die Auswahl auf.`
        : 'Legen Sie ein Konzept an und wählen Sie dann je Parameter eine Ausprägung.');
  }

  function renderMatrix() {
    const matrix = $('#matrix');
    const editing = prefs.mode === 'edit';
    const maxOptions = Math.max(1, ...state.parameters.map(p => p.options.length));
    const cols = maxOptions + (editing ? 1 : 0);
    matrix.style.setProperty('--cols', cols);
    matrix.classList.toggle('is-editing', editing);
    matrix.classList.toggle('is-selecting', !editing);
    matrix.setAttribute('role', 'group');
    matrix.setAttribute('aria-label', 'Morphologische Matrix');

    const cells = [];
    if (!state.parameters.length) {
      cells.push(h('div', { class: 'matrix-empty' },
        editing ? 'Noch keine Parameter – fügen Sie unten den ersten hinzu.'
          : 'Noch keine Parameter. Wechseln Sie in den Modus „Bearbeiten“, um die Matrix aufzubauen.'));
    }

    const active = activeConcept();
    const showBands = state.categories.length > 0;

    const renderParam = (p, pi) => {
      // Kopfzelle des Parameters
      if (editing) {
        const name = h('textarea', {
          class: 'param-name autosize', rows: 1, value: p.name,
          placeholder: `Parameter ${pi + 1}`, 'aria-label': `Name von Parameter ${pi + 1}`,
          dataset: { fid: `param:${p.id}` },
          onkeydown: e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (p.options.length) focusField(`opt:${p.options[0].id}`);
              else addOption(p.id);
            }
          },
        });
        bindField(name, v => { p.name = v; });
        cells.push(h('div', { class: 'param-cell', style: categoryStyle(p) },
          name,
          showBands ? categorySelect(p) : null,
          h('div', { class: 'param-foot' },
            state.settings.utility
              ? h('label', { class: 'weight-field' },
                h('span', null, 'Gewicht'),
                numberField({
                  value: p.weight, placeholder: '1', label: `Gewichtung von ${p.name || `Parameter ${pi + 1}`}`,
                  apply: n => { p.weight = n != null && n >= 0 ? n : null; },
                  validate: n => n >= 0,
                }),
                h('span', { class: 'weight-pct', dataset: { weightPct: p.id } }, weightPercent(p)))
              : null,
            h('div', { class: 'row-tools' },
              iconBtn('up', 'Nach oben verschieben', () => moveParameter(pi, -1), { disabled: !canMoveParameter(pi, -1) }),
              iconBtn('down', 'Nach unten verschieben', () => moveParameter(pi, 1), { disabled: !canMoveParameter(pi, 1) }),
              iconBtn('trash', 'Parameter löschen', () => deleteParameter(p.id), { danger: true }),
            ))));
      } else {
        cells.push(h('div', { class: 'param-cell', style: categoryStyle(p) },
          h('span', { class: 'param-label' }, p.name || `Parameter ${pi + 1}`),
          h('span', { class: 'param-meta' },
            `${p.options.length} ${p.options.length === 1 ? 'Ausprägung' : 'Ausprägungen'}`
            + (state.settings.utility ? ` · Gewicht\u00a0${weightPercent(p)}` : ''))));
      }

      // Ausprägungen
      p.options.forEach((o, oi) => {
        if (editing) {
          const ta = h('textarea', {
            class: 'autosize', rows: 1, value: o.text,
            placeholder: `Ausprägung ${oi + 1}`,
            'aria-label': `${p.name || `Parameter ${pi + 1}`}: Ausprägung ${oi + 1}`,
            dataset: { fid: `opt:${o.id}` },
            onkeydown: e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const next = p.options[oi + 1];
                if (next) focusField(`opt:${next.id}`);
                else if (o.text.trim()) addOption(p.id);
                else {
                  const nextParam = state.parameters[pi + 1];
                  if (nextParam) focusField(`param:${nextParam.id}`);
                }
              } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                // Alt+←/→ verschiebt die Ausprägung (Fokus bleibt im Feld)
                e.preventDefault();
                moveOption(p.id, oi, e.key === 'ArrowLeft' ? -1 : 1);
              } else if (e.key === 'Backspace' && !ta.value && p.options.length > 1) {
                e.preventDefault();
                const prev = p.options[oi - 1] || p.options[oi + 1];
                pendingFocus = `opt:${prev.id}`;
                deleteOption(p.id, o.id);
              }
            },
          });
          bindField(ta, v => { o.text = v; });
          const optLabel = o.text.trim() || `Ausprägung ${oi + 1}`;
          cells.push(h('div', { class: 'opt-cell edit' },
            h('div', { class: 'opt-main' }, ta),
            h('div', { class: 'opt-tools' },
              iconBtn('left', 'Nach links verschieben (Alt+←)', () => moveOption(p.id, oi, -1), { disabled: oi === 0 }),
              iconBtn('right', 'Nach rechts verschieben (Alt+→)', () => moveOption(p.id, oi, 1), { disabled: oi === p.options.length - 1 }),
              iconBtn('x', 'Ausprägung löschen', () => deleteOption(p.id, o.id), { danger: true })),
            evaluationOn()
              ? h('div', { class: 'opt-metrics' },
                state.settings.costs
                  ? h('label', { class: 'metric-field' },
                    h('span', { class: 'metric-unit' }, currencySymbol()),
                    numberField({
                      value: o.cost, placeholder: 'Kosten', label: `Kosten von ${optLabel}`,
                      apply: n => { o.cost = n; },
                    }))
                  : null,
                state.settings.utility
                  ? h('label', { class: 'metric-field' },
                    h('span', { class: 'metric-unit', title: 'Nutzwert (Erfüllungsgrad)' }, 'NW'),
                    numberField({
                      value: o.score, placeholder: `0–${state.settings.utilityMax}`,
                      label: `Nutzwert von ${optLabel} (0 bis ${state.settings.utilityMax})`,
                      apply: n => { o.score = n; },
                      validate: n => n >= 0 && n <= state.settings.utilityMax,
                    }))
                  : null)
              : null));
        } else {
          const selectedBy = state.concepts.filter(c => c.selections[p.id] === o.id);
          const isActive = !!active && active.selections[p.id] === o.id;
          cells.push(h('button', {
            type: 'button',
            class: `opt-cell pick${isActive ? ' is-active' : ''}${o.text.trim() ? '' : ' is-empty'}`,
            'aria-pressed': String(isActive),
            title: selectedBy.length ? `Gewählt in: ${selectedBy.map(c => c.name || 'Unbenannt').join(', ')}` : null,
            style: isActive ? { '--c': active.color } : null,
            dataset: { cell: `${p.id}:${o.id}` },
            onclick: () => toggleSelection(p.id, o.id),
          },
          h('span', { class: 'opt-label' },
            h('span', null, o.text.trim() || `(Ausprägung ${oi + 1})`),
            optionMetricsText(o) ? h('span', { class: 'opt-metrics-view' }, optionMetricsText(o)) : null),
          selectedBy.length
            ? h('span', { class: 'markers', 'aria-hidden': 'true' },
              selectedBy.map(c => h('span', { class: 'marker', style: { '--c': c.color } })))
            : null));
        }
      });

      // Plus-Knopf und Füllzellen
      let used = p.options.length;
      if (editing) {
        cells.push(h('button', {
          type: 'button', class: 'add-opt',
          title: 'Ausprägung hinzufügen', 'aria-label': `Ausprägung zu ${p.name || `Parameter ${pi + 1}`} hinzufügen`,
          onclick: () => addOption(p.id),
        }, icon('plus')));
        used += 1;
      }
      for (let i = used; i < cols; i++) cells.push(h('div', { 'aria-hidden': 'true' }));
    };

    for (const group of categoryGroups()) {
      const cid = group.cat ? group.cat.id : null;
      if (showBands) cells.push(renderBand(group, editing, active));
      if (showBands && isCollapsed(cid)) continue;
      group.items.forEach(({ p, pi }) => renderParam(p, pi));
    }

    matrix.replaceChildren(...cells);
  }

  function categoryStyle(p) {
    const k = categoryById(p.categoryId);
    return k ? { '--k': k.color } : null;
  }

  function categorySelect(p) {
    return h('select', {
      class: 'cat-select', 'aria-label': `Kategorie von ${p.name || 'Parameter'}`, title: 'Kategorie',
      onchange: e => setParameterCategory(p.id, e.target.value),
    },
    h('option', { value: '', selected: !p.categoryId }, 'Ohne Kategorie'),
    state.categories.map(k => h('option', { value: k.id, selected: k.id === p.categoryId }, k.name || 'Unbenannt')),
    h('option', { value: '__new' }, '+ Neue Kategorie …'));
  }

  /** Fortschritt und Auswahl des aktiven Konzepts innerhalb einer Gruppe. */
  function groupProgress(group, concept) {
    const picks = concept ? group.items.map(({ p }) => selectedOption(p, concept)).filter(Boolean) : [];
    const cost = state.settings.costs && picks.length && picks.every(o => o.cost != null)
      ? picks.reduce((s, o) => s + o.cost, 0) : null;
    return { picks, cost };
  }

  function renderBand(group, editing, active) {
    const k = group.cat;
    const cid = k ? k.id : null;
    const collapsed = isCollapsed(cid);
    const n = group.items.length;
    const { picks, cost } = groupProgress(group, active);
    const index = k ? state.categories.indexOf(k) : -1;
    const toggle = h('button', {
      type: 'button', class: 'cat-toggle', 'aria-expanded': String(!collapsed),
      title: collapsed ? 'Ausklappen' : 'Einklappen',
      'aria-label': `${k ? k.name || 'Unbenannt' : 'Ohne Kategorie'} ${collapsed ? 'ausklappen' : 'einklappen'}`,
      onclick: () => toggleCategory(cid),
    }, h('span', { class: 'cat-chevron', 'aria-hidden': 'true' }));

    let title;
    if (editing && k) {
      const color = h('input', { type: 'color', class: 'swatch cat-swatch', value: k.color, 'aria-label': `Farbe von ${k.name}`, title: 'Farbe ändern' });
      bindField(color, v => { k.color = v; }, () => { renderMatrix(); renderCategoryNav(); refreshLight(); });
      const name = h('input', {
        type: 'text', class: 'cat-name', value: k.name, placeholder: 'Kategorie',
        'aria-label': 'Name der Kategorie', dataset: { fid: `cat:${k.id}` },
        onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
      });
      bindField(name, v => { k.name = v; }, () => { renderCategoryNav(); refreshLight(); });
      title = [color, name];
    } else {
      title = [h('span', { class: 'cat-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'cat-title', onclick: () => toggleCategory(cid) }, k ? k.name || 'Unbenannt' : 'Ohne Kategorie')];
    }

    return h('div', {
      class: `cat-band${collapsed ? ' is-collapsed' : ''}${k ? '' : ' is-none'}`,
      style: { '--k': k ? k.color : 'var(--muted)' },
      dataset: { catBand: cid || '__none' },
    },
    toggle,
    title,
    h('span', { class: 'cat-meta' }, `${n} Parameter`),
    collapsed && !editing && picks.length
      ? h('span', { class: 'cat-picks' }, picks.map(o => h('span', null, o.text.trim() || '–')))
      : null,
    h('span', { class: 'cat-end' },
      !editing && active
        ? h('span', { class: 'cat-progress', title: `Auswahl im Konzept „${active.name || 'Unbenannt'}“` },
          `${picks.length}/${n} gewählt` + (cost != null ? ` · ${formatMoney(cost)}` : ''))
        : null,
      editing
        ? h('span', { class: 'cat-tools' },
          h('button', { type: 'button', class: 'btn btn-small', onclick: () => addParameter(cid) }, icon('plus'), 'Parameter'),
          k ? iconBtn('up', 'Kategorie nach oben', () => moveCategory(index, -1), { disabled: index <= 0 }) : null,
          k ? iconBtn('down', 'Kategorie nach unten', () => moveCategory(index, 1), { disabled: index >= state.categories.length - 1 }) : null,
          k ? iconBtn('trash', 'Kategorie löschen (Parameter bleiben erhalten)', () => deleteCategory(k.id), { danger: true }) : null)
        : null));
  }

  function renderCategoryNav() {
    const nav = $('#catNav');
    if (!state.categories.length) {
      nav.hidden = true;
      return;
    }
    nav.hidden = false;
    const active = activeConcept();
    const groups = categoryGroups();
    const allCollapsed = groups.every(g => isCollapsed(g.cat ? g.cat.id : null));
    const allOpen = groups.every(g => !isCollapsed(g.cat ? g.cat.id : null));
    nav.replaceChildren(
      h('div', { class: 'cat-chips' }, groups.map(g => {
        const cid = g.cat ? g.cat.id : null;
        const { picks } = groupProgress(g, active);
        return h('button', {
          type: 'button',
          class: `cat-chip${isCollapsed(cid) ? ' is-collapsed' : ''}`,
          style: { '--k': g.cat ? g.cat.color : 'var(--muted)' },
          title: `Zu „${g.cat ? g.cat.name || 'Unbenannt' : 'Ohne Kategorie'}“ springen`,
          onclick: () => jumpToCategory(cid),
        },
        h('span', { class: 'cat-dot', 'aria-hidden': 'true' }),
        g.cat ? g.cat.name || 'Unbenannt' : 'Ohne Kategorie',
        active ? h('span', { class: 'cat-chip-count' }, `${picks.length}/${g.items.length}`) : null);
      })),
      h('div', { class: 'cat-nav-actions' },
        h('button', { type: 'button', class: 'btn btn-small', disabled: allOpen, onclick: () => setAllCollapsed(false) }, 'Alle ausklappen'),
        h('button', { type: 'button', class: 'btn btn-small', disabled: allCollapsed, onclick: () => setAllCollapsed(true) }, 'Alle einklappen')),
    );
  }

  function currencySymbol() {
    try {
      const part = new Intl.NumberFormat('de-DE', { style: 'currency', currency: state.settings.currency })
        .formatToParts(0).find(x => x.type === 'currency');
      return part ? part.value : state.settings.currency;
    } catch (e) {
      return state.settings.currency;
    }
  }

  function optionMetricsText(o) {
    const parts = [];
    if (state.settings.costs && o.cost != null) parts.push(formatMoney(o.cost));
    if (state.settings.utility && o.score != null) parts.push(`NW ${numberFormat.format(o.score)}`);
    return parts.join(' · ');
  }

  function renderConcepts() {
    const list = $('#conceptList');
    const items = state.concepts.map((c, ci) => {
      const isActive = c.id === state.activeConceptId;
      const li = h('li', {
        class: `concept${isActive ? ' is-active' : ''}`,
        style: { '--c': c.color },
        dataset: { cid: c.id },
        onclick: e => {
          if (e.target.closest('button, input')) return;
          setActiveConcept(c.id);
        },
      });
      const color = h('input', { type: 'color', class: 'swatch', value: c.color, 'aria-label': `Farbe von ${c.name}`, title: 'Farbe ändern' });
      bindField(color, v => { c.color = v; }, () => {
        li.style.setProperty('--c', c.color);
        renderMatrix();
        refreshLight();
      });
      const name = h('input', {
        type: 'text', class: 'concept-name', value: c.name,
        placeholder: `Konzept ${ci + 1}`, 'aria-label': `Name von Konzept ${ci + 1}`,
        onfocus: () => setActiveConceptLight(c.id),
        onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
      });
      bindField(name, v => { c.name = v; });
      li.append(
        color,
        name,
        h('span', { class: 'concept-progress', dataset: { progress: c.id } }),
        iconBtn('copy', 'Konzept duplizieren', () => duplicateConcept(c.id)),
        iconBtn('trash', 'Konzept löschen', () => deleteConcept(c.id), { danger: true }),
      );
      return li;
    });
    if (!items.length) items.push(h('li', { class: 'summary-empty' }, 'Noch keine Konzepte.'));
    list.replaceChildren(...items);
  }

  /** Aktiviert ein Konzept, ohne die Konzeptliste (und damit das fokussierte Feld) neu zu erzeugen. */
  function setActiveConceptLight(cid) {
    if (state.activeConceptId === cid) return;
    state.activeConceptId = cid;
    save();
    document.querySelectorAll('.concept').forEach(li => li.classList.toggle('is-active', li.dataset.cid === cid));
    renderMatrix();
    refreshLight();
  }

  function updateProgress() {
    const total = state.parameters.length;
    for (const c of state.concepts) {
      const el = document.querySelector(`[data-progress="${c.id}"]`);
      if (!el) continue;
      const filled = state.parameters.filter(p => c.selections[p.id]).length;
      el.textContent = `${filled}/${total}`;
      el.title = `${filled} von ${total} Parametern gewählt`;
    }
  }

  function optionText(p, oid) {
    const idx = p.options.findIndex(o => o.id === oid);
    if (idx < 0) return null;
    return p.options[idx].text.trim() || `(Ausprägung ${idx + 1})`;
  }

  // ---------- Bewertung (Kosten & Nutzwert) ----------

  const evaluationOn = () => state.settings.costs || state.settings.utility;
  const weightOf = p => (p.weight == null ? 1 : p.weight);
  const totalWeight = () => state.parameters.reduce((s, p) => s + weightOf(p), 0);
  const clampScore = s => Math.min(state.settings.utilityMax, Math.max(0, s));

  function selectedOption(p, c) {
    const oid = c.selections[p.id];
    return oid ? p.options.find(o => o.id === oid) || null : null;
  }

  /** Summe der Kosten aller gewählten Ausprägungen; `missing` zählt fehlende Angaben. */
  function conceptCost(c) {
    let total = 0;
    let missing = 0;
    for (const p of state.parameters) {
      const o = selectedOption(p, c);
      if (!o || o.cost == null) missing++;
      else total += o.cost;
    }
    return { total, missing };
  }

  /**
   * Gesamtnutzwert wie in der Nutzwertanalyse: Σ (Gewicht × Erfüllungsgrad) / Σ Gewichte.
   * Nicht gewählte oder unbewertete Parameter gehen mit 0 ein.
   */
  function conceptUtility(c) {
    const sumW = totalWeight();
    let sum = 0;
    let missing = 0;
    for (const p of state.parameters) {
      const o = selectedOption(p, c);
      if (!o || o.score == null) {
        if (weightOf(p) > 0) missing++;
        continue;
      }
      sum += weightOf(p) * clampScore(o.score);
    }
    return { value: sumW > 0 ? sum / sumW : null, missing };
  }

  /**
   * Preis-Leistungs-Verhältnis als Kosten je Nutzwertpunkt (niedriger ist besser).
   * Nur sinnvoll, wenn Kosten und Nutzwerte des Konzepts vollständig gepflegt sind.
   */
  function priceValue(c) {
    const cost = conceptCost(c);
    const util = conceptUtility(c);
    if (cost.missing || util.missing) {
      return { value: null, reason: 'Nicht berechenbar: Kosten oder Nutzwerte sind unvollständig.' };
    }
    if (!util.value) return { value: null, reason: 'Nicht berechenbar: Der Nutzwert ist 0.' };
    return { value: cost.total / util.value, reason: null };
  }

  function weightPercent(p) {
    const sumW = totalWeight();
    return sumW > 0 ? `${numberFormat.format(Math.round((weightOf(p) / sumW) * 1000) / 10)}\u00a0%` : '–';
  }

  function updateWeightPercents() {
    for (const p of state.parameters) {
      const el = document.querySelector(`[data-weight-pct="${p.id}"]`);
      if (el) el.textContent = weightPercent(p);
    }
  }

  function missingNote(missing) {
    return missing ? ` (${missing} ${missing === 1 ? 'Wert fehlt' : 'Werte fehlen'})` : '';
  }

  /** Eingabefeld für Zahlen; speichert beim Tippen, formatiert beim Verlassen. */
  function numberField({ value, label, placeholder, fid, apply, validate }) {
    const input = h('input', {
      type: 'text', inputmode: 'decimal', class: 'num-input', value: numberToInput(value),
      placeholder, 'aria-label': label, title: label, dataset: fid ? { fid } : null,
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    });
    const check = n => {
      const bad = Number.isNaN(n) || (n != null && !!validate && !validate(n));
      input.toggleAttribute('aria-invalid', bad);
    };
    bindField(input, v => {
      const n = parseNumber(v);
      check(n);
      apply(Number.isNaN(n) ? null : n);
    });
    input.addEventListener('blur', () => {
      const n = parseNumber(input.value);
      if (!Number.isNaN(n)) input.value = numberToInput(n);
    });
    check(value);
    return input;
  }

  function renderSummary() {
    const box = $('#conceptSummary');
    const c = activeConcept();
    if (!c) {
      box.replaceChildren(h('p', { class: 'summary-empty' }, 'Kein Konzept ausgewählt.'));
      return;
    }
    const showCats = state.categories.length > 0;
    const rows = categoryGroups().flatMap(g => [
      showCats && g.items.length
        ? h('div', { class: 'summary-cat', style: { '--k': g.cat ? g.cat.color : 'var(--muted)' } }, g.cat ? g.cat.name || 'Unbenannt' : 'Ohne Kategorie')
        : null,
      ...g.items.flatMap(({ p, pi }) => {
        const text = optionText(p, c.selections[p.id]);
        return [
          h('dt', null, p.name || `Parameter ${pi + 1}`),
          h('dd', text ? null : { class: 'none' }, text || 'nicht gewählt'),
        ];
      }),
    ]).filter(Boolean);
    const metrics = [];
    if (state.parameters.length && state.settings.costs) {
      const { total, missing } = conceptCost(c);
      metrics.push(h('div', { class: 'metric' },
        h('span', null, 'Gesamtkosten'),
        h('strong', null, formatMoney(total)),
        missing ? h('small', null, missingNote(missing).trim()) : null));
    }
    if (state.parameters.length && state.settings.utility) {
      const { value, missing } = conceptUtility(c);
      metrics.push(h('div', { class: 'metric' },
        h('span', null, 'Nutzwert'),
        h('strong', null, value == null ? '–' : `${numberFormat.format(value)} / ${state.settings.utilityMax}`),
        missing ? h('small', null, missingNote(missing).trim()) : null));
    }
    // replaceChildren() würde null als Text „null“ einfügen – daher leere Teile herausfiltern.
    box.replaceChildren(...[
      h('h3', { style: { '--c': c.color } }, c.name || 'Unbenanntes Konzept'),
      metrics.length ? h('div', { class: 'metrics' }, metrics) : null,
      rows.length ? h('dl', null, rows) : h('p', { class: 'summary-empty' }, 'Die Matrix enthält noch keine Parameter.'),
    ].filter(Boolean));
  }

  function renderCompare() {
    const section = $('#compareSection');
    if (!state.concepts.length || !state.parameters.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    const open = prefs.compareOpen !== false;
    $('#compareToggle').setAttribute('aria-expanded', String(open));
    $('#compareBody').hidden = !open;
    const n = state.concepts.length;
    $('#compareMeta').textContent = `${n} ${n === 1 ? 'Konzept' : 'Konzepte'}`;
    if (open) buildCompareTable();
  }

  function buildCompareTable() {
    const table = $('#compareTable');
    const head = h('thead', null, h('tr', null,
      h('th', { scope: 'col' }, 'Parameter'),
      state.concepts.map(c => h('th', { scope: 'col', style: { '--c': c.color } }, h('span', { 'aria-hidden': 'true' }), c.name || 'Unbenannt'))));
    const showCats = state.categories.length > 0;
    const body = h('tbody', null, categoryGroups().flatMap(g => [
      showCats && g.items.length
        ? h('tr', { class: 'cat-row', style: { '--k': g.cat ? g.cat.color : 'var(--muted)' } },
          h('th', { scope: 'colgroup', colspan: String(state.concepts.length + 1) }, g.cat ? g.cat.name || 'Unbenannt' : 'Ohne Kategorie'))
        : null,
      ...g.items.map(({ p, pi }) => h('tr', null,
        h('th', { scope: 'row' }, p.name || `Parameter ${pi + 1}`),
        state.concepts.map(c => {
          const text = optionText(p, c.selections[p.id]);
          return h('td', text ? null : { class: 'none' }, text || '–');
        }))),
    ]).filter(Boolean));
    const footRows = [];
    if (state.settings.costs) {
      const costs = state.concepts.map(conceptCost);
      const complete = costs.filter(x => !x.missing).map(x => x.total);
      const best = complete.length > 1 ? Math.min(...complete) : null;
      footRows.push(h('tr', null, h('th', { scope: 'row' }, 'Gesamtkosten'),
        costs.map(x => h('td', {
          class: [x.missing ? 'incomplete' : '', !x.missing && x.total === best ? 'best' : ''].join(' ').trim() || null,
          title: x.missing ? missingNote(x.missing).trim().slice(1, -1) : null,
        }, formatMoney(x.total) + (x.missing ? ' *' : '')))));
    }
    if (state.settings.utility) {
      const utils = state.concepts.map(conceptUtility);
      const values = utils.filter(x => x.value != null).map(x => x.value);
      const best = values.length > 1 ? Math.max(...values) : null;
      footRows.push(h('tr', null, h('th', { scope: 'row' }, `Nutzwert (max. ${state.settings.utilityMax})`),
        utils.map(x => h('td', {
          class: [x.missing ? 'incomplete' : '', x.value != null && x.value === best ? 'best' : ''].join(' ').trim() || null,
          title: x.missing ? missingNote(x.missing).trim().slice(1, -1) : null,
        }, x.value == null ? '–' : numberFormat.format(x.value) + (x.missing ? ' *' : '')))));
    }
    if (state.settings.costs && state.settings.utility) {
      const ratios = state.concepts.map(priceValue);
      const values = ratios.filter(x => x.value != null).map(x => x.value);
      const best = values.length > 1 ? Math.min(...values) : null;
      footRows.push(h('tr', null,
        h('th', { scope: 'row', title: 'Gesamtkosten geteilt durch Nutzwert – je niedriger, desto besser' },
          'Preis-Leistung', h('small', { class: 'th-note' }, 'Kosten je Nutzwertpunkt')),
        ratios.map(x => h('td', {
          class: x.value == null ? 'incomplete' : (x.value === best ? 'best' : null),
          title: x.reason,
        }, x.value == null ? '–' : formatMoney(x.value)))));
    }
    table.replaceChildren(...[head, body, footRows.length ? h('tfoot', null, footRows) : null].filter(Boolean));
  }

  // ---------- Verbindungslinien ----------

  let linesFrame = 0;
  function scheduleLines() {
    cancelAnimationFrame(linesFrame);
    linesFrame = requestAnimationFrame(drawLines);
  }

  function drawLines() {
    const svg = $('#lines');
    const wrap = $('#matrixWrap');
    svg.replaceChildren();
    if (prefs.mode !== 'select' || !prefs.showLines) return;

    const wr = wrap.getBoundingClientRect();
    svg.style.width = `${wrap.scrollWidth}px`;
    svg.style.height = `${wrap.scrollHeight}px`;
    const ns = 'http://www.w3.org/2000/svg';
    const n = state.concepts.length;

    // Aktives Konzept zuletzt zeichnen, damit es oben liegt.
    const order = state.concepts
      .map((c, ci) => ({ c, ci }))
      .sort((a, b) => (a.c.id === state.activeConceptId) - (b.c.id === state.activeConceptId));

    for (const { c, ci } of order) {
      const pts = [];
      for (const p of state.parameters) {
        // Eingeklappte Kategorie: Linie unterbrechen statt quer über die Kopfzeile zu führen
        if (state.categories.length && isCollapsed(p.categoryId)) {
          if (pts.length && pts[pts.length - 1] !== null) pts.push(null);
          continue;
        }
        const oid = c.selections[p.id];
        if (!oid) continue;
        const el = wrap.querySelector(`[data-cell="${CSS.escape(`${p.id}:${oid}`)}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const spread = Math.min(6, (r.width - 24) / Math.max(1, n));
        const x = r.left - wr.left + r.width / 2 + (ci - (n - 1) / 2) * spread;
        pts.push({ x, top: r.top - wr.top, bottom: r.bottom - wr.top });
      }
      if (pts.length < 2) continue;
      let d = '';
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (!a || !b) continue;
        const dy = (b.top - a.bottom) / 2;
        d += `M${a.x.toFixed(1)},${a.bottom.toFixed(1)} C${a.x.toFixed(1)},${(a.bottom + dy).toFixed(1)} ${b.x.toFixed(1)},${(b.top - dy).toFixed(1)} ${b.x.toFixed(1)},${b.top.toFixed(1)} `;
      }
      if (!d) continue;
      const isActive = c.id === state.activeConceptId;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', c.color);
      path.setAttribute('stroke-width', isActive ? '3' : '2');
      path.setAttribute('opacity', isActive ? '1' : '.55');
      svg.append(path);
    }
  }

  // ---------- Fokus & Größen ----------

  function focusField(fid) {
    const el = document.querySelector(`[data-fid="${CSS.escape(fid)}"]`);
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try { el.setSelectionRange(len, len); } catch (e) { /* nicht unterstützt */ }
  }

  function applyPendingFocus() {
    if (!pendingFocus) return;
    const fid = pendingFocus;
    pendingFocus = null;
    focusField(fid);
  }

  const supportsFieldSizing = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content');

  function autosize(el) {
    if (supportsFieldSizing) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }

  function autosizeAll() {
    if (supportsFieldSizing) return;
    document.querySelectorAll('textarea.autosize, #description').forEach(autosize);
  }

  // ---------- Toast ----------

  let toastTimer = 0;
  function toast(message, withUndo = false) {
    const el = $('#toast');
    clearTimeout(toastTimer);
    el.replaceChildren(h('span', null, message));
    if (withUndo) {
      el.append(h('button', { type: 'button', onclick: () => { undo(); el.hidden = true; } }, 'Rückgängig'));
    }
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, withUndo ? 6000 : 3500);
  }

  // ---------- Import / Export ----------

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    download(`${slugify(state.title)}.json`, JSON.stringify(state, null, 2), 'application/json');
  }

  function exportCsv() {
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const maxOptions = Math.max(0, ...state.parameters.map(p => p.options.length));
    const withCats = state.categories.length > 0;
    const catHead = withCats ? [cell('Kategorie')] : [];
    const catCell = p => (withCats ? [cell((categoryById(p.categoryId) || { name: '' }).name)] : []);
    const lines = [
      [cell('Titel'), cell(state.title)],
      [cell('Beschreibung'), cell(state.description)],
      [],
      [...catHead, cell('Parameter'), ...Array.from({ length: maxOptions }, (_, i) => cell(`Ausprägung ${i + 1}`))],
      ...state.parameters.map(p => [...catCell(p), cell(p.name), ...p.options.map(o => cell(o.text))]),
    ];
    const { costs, utility } = state.settings;
    const csvNum = n => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
    if (costs || utility) {
      lines.push([], [...catHead, cell('Parameter'),
        ...(utility ? [cell('Gewicht')] : []),
        cell('Ausprägung'),
        ...(costs ? [cell(`Kosten (${state.settings.currency})`)] : []),
        ...(utility ? [cell(`Nutzwert (0–${state.settings.utilityMax})`)] : [])]);
      for (const p of state.parameters) {
        for (const o of p.options) {
          lines.push([...catCell(p), cell(p.name),
            ...(utility ? [csvNum(weightOf(p))] : []),
            cell(o.text),
            ...(costs ? [csvNum(o.cost)] : []),
            ...(utility ? [csvNum(o.score)] : [])]);
        }
      }
    }
    if (state.concepts.length) {
      lines.push([], [cell('Konzept'), ...state.parameters.map(p => cell(p.name)),
        ...(costs ? [cell(`Gesamtkosten (${state.settings.currency})`)] : []),
        ...(utility ? [cell('Nutzwert')] : []),
        ...(costs && utility ? [cell(`Kosten je Nutzwertpunkt (${state.settings.currency})`)] : [])]);
      for (const c of state.concepts) {
        lines.push([cell(c.name), ...state.parameters.map(p => cell(optionText(p, c.selections[p.id]) || '')),
          ...(costs ? [csvNum(conceptCost(c).total)] : []),
          ...(utility ? [csvNum(conceptUtility(c).value)] : []),
          ...(costs && utility ? [csvNum(priceValue(c).value)] : [])]);
      }
    }
    download(`${slugify(state.title)}.csv`, '﻿' + lines.map(l => l.join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalize(JSON.parse(String(reader.result)));
        openNewDoc(next, `„${next.title || file.name}“ geöffnet.`);
      } catch (e) {
        toast(`Datei konnte nicht gelesen werden: ${e.message}`);
      }
    };
    reader.onerror = () => toast('Datei konnte nicht gelesen werden.');
    reader.readAsText(file);
  }

  function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(b64) {
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
  }

  async function shareLink() {
    const url = `${location.href.split('#')[0]}#m=${toBase64Url(JSON.stringify(state))}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link in die Zwischenablage kopiert.');
    } catch (e) {
      window.prompt('Link zum Teilen (kopieren mit Strg+C):', url);
    }
  }

  function loadFromHash() {
    const match = location.hash.match(/^#m=([A-Za-z0-9_-]+)$/);
    if (!match) return;
    try {
      const next = normalize(JSON.parse(fromBase64Url(match[1])));
      docId = uid();
      state = next;
      save();
      toast(`Geteilte Matrix „${next.title}“ als neue Matrix geöffnet.`);
    } catch (e) {
      toast('Der geteilte Link ist ungültig.');
    }
    history.replaceState(null, '', location.pathname + location.search);
  }

  function printMatrix() {
    if (prefs.mode !== 'select') setMode('select');
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  // ---------- Bibliothek ----------

  const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

  function openLibrary() {
    renderLibrary();
    const dialog = $('#libraryDialog');
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function closeLibrary() {
    const dialog = $('#libraryDialog');
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
  }

  function renderLibrary() {
    const docs = listDocs();
    if (!docs.some(d => d.id === docId)) docs.unshift({ id: docId, savedAt: Date.now(), data: state });
    const items = docs.map(doc => {
      const current = doc.id === docId;
      const data = current ? state : doc.data;
      const P = data.parameters.length;
      const C = data.concepts.length;
      return h('li', { class: `doc${current ? ' is-current' : ''}` },
        h('div', { class: 'doc-info' },
          h('span', { class: 'doc-title' }, data.title || 'Unbenannte Matrix',
            current ? h('span', { class: 'badge' }, 'dieser Tab') : null),
          h('span', { class: 'doc-meta' },
            `${dateFormat.format(new Date(doc.savedAt))} · ${P} Parameter · ${C} ${C === 1 ? 'Konzept' : 'Konzepte'}`)),
        h('div', { class: 'doc-actions' },
          h('button', {
            type: 'button', class: 'btn btn-small', disabled: current,
            onclick: () => {
              const fresh = readDoc(doc.id);
              if (!fresh) { toast('Diese Matrix existiert nicht mehr.'); renderLibrary(); return; }
              closeLibrary();
              openDoc(fresh.id, fresh.data, `„${fresh.data.title || 'Unbenannte Matrix'}“ geöffnet.`);
            },
          }, 'Öffnen'),
          h('a', {
            class: 'btn btn-small', href: `?doc=${encodeURIComponent(doc.id)}`, target: '_blank', rel: 'noopener',
            title: 'In einem neuen Tab öffnen',
          }, 'Neuer Tab'),
          iconBtn('trash', current ? 'Die Matrix dieses Tabs kann nicht gelöscht werden' : 'Matrix löschen', () => {
            if (!window.confirm(`Matrix „${data.title || 'Unbenannte Matrix'}“ endgültig löschen?`)) return;
            storage.remove('localStorage', DOC_PREFIX + doc.id);
            renderLibrary();
          }, { danger: true, disabled: current })));
    });
    $('#docList').replaceChildren(...items);
  }

  // ---------- Einstellungen ----------

  function syncSettingsForm() {
    const s = state.settings;
    $('#setCosts').checked = s.costs;
    $('#setCurrency').value = s.currency;
    $('#setCurrency').disabled = !s.costs;
    $('#setUtility').checked = s.utility;
    $('#setScale').value = String(s.utilityMax);
    $('#setScale').disabled = !s.utility;
  }

  function openSettings() {
    syncSettingsForm();
    const dialog = $('#settingsDialog');
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function closeSettings() {
    const dialog = $('#settingsDialog');
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
  }

  function changeSetting(key, value) {
    if (state.settings[key] === value) return;
    mutate(s => { s.settings[key] = value; });
  }

  /** Neue Nutzwert-Skala; vorhandene Werte werden auf Wunsch proportional umgerechnet. */
  function changeScale(max) {
    const oldMax = state.settings.utilityMax;
    if (max === oldMax) return;
    const hasScores = state.parameters.some(p => p.options.some(o => o.score != null));
    const rescale = hasScores && window.confirm(
      `Vorhandene Nutzwerte von der Skala 0–${oldMax} auf 0–${max} umrechnen?\n\n`
      + 'OK: umrechnen (z. B. wird 7 von 10 zu 3,5 von 5)\nAbbrechen: Werte unverändert lassen');
    mutate(s => {
      s.settings.utilityMax = max;
      if (!rescale) return;
      for (const p of s.parameters) {
        for (const o of p.options) {
          if (o.score != null) o.score = Math.round((o.score / oldMax) * max * 100) / 100;
        }
      }
    });
  }

  // ---------- Menü ----------

  function toggleMenu(open) {
    const btn = $('#menuBtn');
    const list = $('#menuList');
    const willOpen = open ?? list.hidden;
    list.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) list.querySelector('button').focus();
  }

  const menuActions = {
    new: () => { openNewDoc(blankState(), 'Neue Matrix angelegt.'); setMode('edit'); },
    example: () => openNewDoc(exampleState(), 'Beispiel als neue Matrix geöffnet.'),
    open: openLibrary,
    settings: openSettings,
    'export-json': exportJson,
    'import-json': () => $('#importFile').click(),
    'export-csv': exportCsv,
    share: shareLink,
    print: printMatrix,
  };

  // ---------- Initialisierung ----------

  function init() {
    bindField($('#title'), v => { state.title = v; }, () => {
      document.title = state.title ? `${state.title} – Morphologische Matrix` : 'Morphologische Matrix';
      refreshLight();
    });
    const desc = $('#description');
    bindField(desc, v => { state.description = v; }, () => autosize(desc));

    document.querySelectorAll('.segmented button').forEach(b => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
    });
    $('#undoBtn').addEventListener('click', undo);
    $('#redoBtn').addEventListener('click', redo);
    $('#addParamBtn').addEventListener('click', () => addParameter(null));
    $('#addCategoryBtn').addEventListener('click', addCategory);
    $('#addConceptBtn').addEventListener('click', addConcept);
    $('#randomBtn').addEventListener('click', randomizeActive);
    document.querySelectorAll('[data-generate]').forEach(btn => {
      btn.addEventListener('click', () => generateConcept(btn.dataset.generate));
    });
    $('#clearSelBtn').addEventListener('click', clearActive);
    $('#compareToggle').addEventListener('click', () => {
      prefs.compareOpen = prefs.compareOpen === false;
      savePrefs();
      renderCompare();
    });
    $('#showLines').addEventListener('change', e => {
      prefs.showLines = e.target.checked;
      savePrefs();
      scheduleLines();
    });

    // Menü
    $('#menuBtn').addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
    $('#menuList').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      toggleMenu(false);
      menuActions[btn.dataset.action]();
    });
    $('#menuList').addEventListener('keydown', e => {
      const items = [...$('#menuList').querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.menu')) toggleMenu(false);
    });

    $('#libraryClose').addEventListener('click', closeLibrary);
    $('#settingsClose').addEventListener('click', closeSettings);
    $('#settingsDone').addEventListener('click', closeSettings);
    $('#settingsDialog').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeSettings();
    });
    $('#setCosts').addEventListener('change', e => changeSetting('costs', e.target.checked));
    $('#setUtility').addEventListener('change', e => changeSetting('utility', e.target.checked));
    $('#setCurrency').addEventListener('change', e => changeSetting('currency', e.target.value));
    $('#setScale').addEventListener('change', e => changeScale(Number(e.target.value)));
    $('#libraryDialog').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeLibrary();
    });

    $('#importFile').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) importJson(file);
      e.target.value = '';
    });

    // Tastenkürzel
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('#menuList').hidden) {
        toggleMenu(false);
        $('#menuBtn').focus();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const inField = e.target.closest('input, textarea');
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        exportJson();
      } else if (!inField && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (!inField && key === 'y') {
        e.preventDefault();
        redo();
      }
    });

    // Linien bei Größenänderungen neu berechnen
    if ('ResizeObserver' in window) new ResizeObserver(scheduleLines).observe($('#matrix'));
    window.addEventListener('resize', scheduleLines);
    window.addEventListener('beforeprint', () => {
      // Beim Drucken alle Kategorien und den Vergleich vollständig ausgeben
      printing = true;
      renderMatrix();
      buildCompareTable();
      $('#compareBody').hidden = false;
      drawLines();
    });
    window.addEventListener('afterprint', () => {
      printing = false;
      renderMatrix();
      renderCompare();
      scheduleLines();
    });

    // Nur wenn ein anderer Tab dieselbe Matrix bearbeitet, dessen Änderungen übernehmen.
    window.addEventListener('storage', e => {
      if (e.key === DOC_PREFIX + docId && e.newValue) {
        const doc = readDoc(docId);
        if (!doc) return;
        state = doc.data;
        lastSaved = JSON.stringify(state);
        // Eigener Verlauf passt nicht mehr zum fremden Stand.
        undoStack.length = 0;
        redoStack.length = 0;
        render();
      }
      if ($('#libraryDialog').open) renderLibrary();
    });

    loadFromHash();
    save(); // auch eine neu erzeugte Startmatrix sofort sichern (stabile IDs nach Neuladen)
    render();
  }

  init();
})();
