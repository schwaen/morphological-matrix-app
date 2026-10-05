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

  const STORAGE_KEY = 'morphologische-matrix:v1';
  const PREFS_KEY = 'morphologische-matrix:prefs';
  const HISTORY_LIMIT = 200;
  const COLORS = ['#e8590c', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#e03131', '#0c8599', '#f08c00', '#5f3dc4'];

  const ICONS = {
    up: 'M6 15l6-6 6 6',
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

  function blankState() {
    const parameters = [1, 2, 3].map(i => ({
      id: uid(),
      name: `Parameter ${i}`,
      options: [{ id: uid(), text: '' }, { id: uid(), text: '' }],
    }));
    const concept = { id: uid(), name: 'Konzept 1', color: COLORS[0], selections: {} };
    return {
      version: 1,
      title: 'Neue morphologische Matrix',
      description: '',
      parameters,
      concepts: [concept],
      activeConceptId: concept.id,
    };
  }

  function exampleState() {
    const rows = [
      ['Wassererwärmung', ['Durchlauferhitzer', 'Boiler', 'Thermoblock', 'Induktion']],
      ['Druckerzeugung', ['Schwerkraft', 'Vibrationspumpe', 'Rotationspumpe', 'Handhebel']],
      ['Kaffeezufuhr', ['Pulver (lose)', 'Kapsel', 'Pad', 'Bohnen mit Mahlwerk']],
      ['Bedienung', ['Drehknopf', 'Tasten', 'Touch-Display', 'Smartphone-App']],
      ['Energieversorgung', ['Netzstrom', 'Akku', 'Gaskartusche', 'Muskelkraft']],
      ['Reinigung', ['Manuell', 'Automatische Spülung', 'Spülmaschinenfest']],
    ];
    const parameters = rows.map(([name, opts]) => ({
      id: uid(),
      name,
      options: opts.map(text => ({ id: uid(), text })),
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
    const parameters = data.parameters.map(p => ({
      id: id(p && p.id),
      name: str(p && p.name),
      options: (Array.isArray(p && p.options) ? p.options : []).map(o =>
        typeof o === 'string' ? { id: id(), text: o } : { id: id(o && o.id), text: str(o && o.text) }),
    }));
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
      parameters,
      concepts,
      activeConceptId,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* Speicher nicht verfügbar oder beschädigt */ }
    return exampleState();
  }

  function loadPrefs() {
    const defaults = { mode: 'select', showLines: true };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    } catch (e) {
      return defaults;
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignorieren */ }
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignorieren */ }
  }

  let state = loadState();
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

  function addParameter() {
    const p = { id: uid(), name: '', options: [{ id: uid(), text: '' }, { id: uid(), text: '' }] };
    pendingFocus = `param:${p.id}`;
    mutate(s => { s.parameters.push(p); });
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
    const o = { id: uid(), text: '' };
    pendingFocus = `opt:${o.id}`;
    mutate(s => {
      const p = s.parameters.find(x => x.id === pid);
      const at = afterIndex == null ? p.options.length : afterIndex + 1;
      p.options.splice(at, 0, o);
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

  function clearActive() {
    const c = activeConcept();
    if (!c || !Object.keys(c.selections).length) return;
    mutate(s => { s.concepts.find(x => x.id === s.activeConceptId).selections = {}; });
  }

  function replaceState(next, message) {
    mutate(s => {
      Object.keys(s).forEach(k => delete s[k]);
      Object.assign(s, next);
    });
    if (message) toast(message, true);
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

    renderMatrix();
    renderConcepts();
    refreshLight();
    updateHistoryButtons();
    autosizeAll();
    applyPendingFocus();
  }

  /** Leichte Aktualisierung ohne Eingabefelder neu zu erzeugen. */
  function refreshLight() {
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

    state.parameters.forEach((p, pi) => {
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
        cells.push(h('div', { class: 'param-cell' },
          name,
          h('div', { class: 'row-tools' },
            iconBtn('up', 'Nach oben verschieben', () => moveParameter(pi, -1), { disabled: pi === 0 }),
            iconBtn('down', 'Nach unten verschieben', () => moveParameter(pi, 1), { disabled: pi === state.parameters.length - 1 }),
            iconBtn('trash', 'Parameter löschen', () => deleteParameter(p.id), { danger: true }),
          )));
      } else {
        cells.push(h('div', { class: 'param-cell' },
          h('span', { class: 'param-label' }, p.name || `Parameter ${pi + 1}`),
          h('span', { class: 'param-meta' }, `${p.options.length} ${p.options.length === 1 ? 'Ausprägung' : 'Ausprägungen'}`)));
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
              } else if (e.key === 'Backspace' && !ta.value && p.options.length > 1) {
                e.preventDefault();
                const prev = p.options[oi - 1] || p.options[oi + 1];
                pendingFocus = `opt:${prev.id}`;
                deleteOption(p.id, o.id);
              }
            },
          });
          bindField(ta, v => { o.text = v; });
          cells.push(h('div', { class: 'opt-cell edit' },
            ta,
            iconBtn('x', 'Ausprägung löschen', () => deleteOption(p.id, o.id), { danger: true })));
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
          h('span', null, o.text.trim() || `(Ausprägung ${oi + 1})`),
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
    });

    matrix.replaceChildren(...cells);
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

  function renderSummary() {
    const box = $('#conceptSummary');
    const c = activeConcept();
    if (!c) {
      box.replaceChildren(h('p', { class: 'summary-empty' }, 'Kein Konzept ausgewählt.'));
      return;
    }
    const rows = state.parameters.flatMap((p, pi) => {
      const text = optionText(p, c.selections[p.id]);
      return [
        h('dt', null, p.name || `Parameter ${pi + 1}`),
        h('dd', text ? null : { class: 'none' }, text || 'nicht gewählt'),
      ];
    });
    box.replaceChildren(
      h('h3', { style: { '--c': c.color } }, c.name || 'Unbenanntes Konzept'),
      rows.length ? h('dl', null, rows) : h('p', { class: 'summary-empty' }, 'Die Matrix enthält noch keine Parameter.'),
    );
  }

  function renderCompare() {
    const section = $('#compareSection');
    const table = $('#compareTable');
    if (!state.concepts.length || !state.parameters.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    const head = h('thead', null, h('tr', null,
      h('th', { scope: 'col' }, 'Parameter'),
      state.concepts.map(c => h('th', { scope: 'col', style: { '--c': c.color } }, h('span', { 'aria-hidden': 'true' }), c.name || 'Unbenannt'))));
    const body = h('tbody', null, state.parameters.map((p, pi) => h('tr', null,
      h('th', { scope: 'row' }, p.name || `Parameter ${pi + 1}`),
      state.concepts.map(c => {
        const text = optionText(p, c.selections[p.id]);
        return h('td', text ? null : { class: 'none' }, text || '–');
      }))));
    table.replaceChildren(head, body);
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
        const dy = (b.top - a.bottom) / 2;
        d += `M${a.x.toFixed(1)},${a.bottom.toFixed(1)} C${a.x.toFixed(1)},${(a.bottom + dy).toFixed(1)} ${b.x.toFixed(1)},${(b.top - dy).toFixed(1)} ${b.x.toFixed(1)},${b.top.toFixed(1)} `;
      }
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
    const lines = [
      [cell('Titel'), cell(state.title)],
      [cell('Beschreibung'), cell(state.description)],
      [],
      [cell('Parameter'), ...Array.from({ length: maxOptions }, (_, i) => cell(`Ausprägung ${i + 1}`))],
      ...state.parameters.map(p => [cell(p.name), ...p.options.map(o => cell(o.text))]),
    ];
    if (state.concepts.length) {
      lines.push([], [cell('Konzept'), ...state.parameters.map(p => cell(p.name))]);
      for (const c of state.concepts) {
        lines.push([cell(c.name), ...state.parameters.map(p => cell(optionText(p, c.selections[p.id]) || ''))]);
      }
    }
    download(`${slugify(state.title)}.csv`, '﻿' + lines.map(l => l.join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalize(JSON.parse(String(reader.result)));
        replaceState(next, `„${next.title || file.name}“ geöffnet.`);
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
      if (window.confirm(`Geteilte Matrix „${next.title}“ öffnen? Ihre aktuelle Matrix wird ersetzt (Rückgängig ist möglich).`)) {
        pushHistory(snapshot());
        state = next;
        save();
      }
    } catch (e) {
      toast('Der geteilte Link ist ungültig.');
    }
    history.replaceState(null, '', location.pathname + location.search);
  }

  function printMatrix() {
    if (prefs.mode !== 'select') setMode('select');
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
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
    new: () => { replaceState(blankState(), 'Neue Matrix angelegt.'); setMode('edit'); },
    example: () => replaceState(exampleState(), 'Beispiel geladen.'),
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
    $('#addParamBtn').addEventListener('click', addParameter);
    $('#addConceptBtn').addEventListener('click', addConcept);
    $('#randomBtn').addEventListener('click', randomizeActive);
    $('#clearSelBtn').addEventListener('click', clearActive);
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
    window.addEventListener('beforeprint', drawLines);

    // Änderungen aus anderen Tabs übernehmen
    window.addEventListener('storage', e => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        state = normalize(JSON.parse(e.newValue));
        render();
      } catch (err) { /* ignorieren */ }
    });

    loadFromHash();
    render();
  }

  init();
})();
