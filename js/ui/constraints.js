/*
 * Verträglichkeiten in der Oberfläche: Texte zu Konflikten und Hinweisen, die Pflege direkt an
 * einer Ausprägung (Popover, Bearbeiten-Modus) und die Übersicht als Verträglichkeitsmatrix
 * (Dialog „Verträglichkeiten“). Die Logik steht in js/consistency.js.
 */
'use strict';

/** Ausprägung samt Parameter und Anzeigetexten zu einer ID. @param {string} oid */
function optionRef(oid) {
  const r = Model.findOption(state, oid);
  return r && { ...r, text: optText(r.o, r.oi), param: Model.parameterLabel(r.p, r.pi) };
}

/** „Induktion (Wassererwärmung)“ @param {string} oid */
function optionWithParam(oid) {
  const r = optionRef(oid);
  return r ? Texts.cons.withParam(r.text, r.param) : '';
}

/** Anderes Ende eines Paars. @param {MatrixConstraint} c @param {string} oid */
const otherOf = (c, oid) => (c.a === oid ? c.b : c.a);

/** Hinweis für eine gewählte Ausprägung mit unverträglichen Partnern. @param {string} oid @param {MatrixConstraint[]} list */
function conflictText(oid, list) {
  return {
    type: 'excluded',
    label: Texts.cons.conflictLabel,
    text: list.map(c => Texts.cons.excludedWith(optionWithParam(otherOf(c, oid)), c.note)).join('\n'),
  };
}

/** Hinweis für eine nicht gewählte Ausprägung. @param {{ type: MatrixConstraintType, with: string, note: string }} st */
function statusText(st) {
  return {
    type: st.type,
    label: Texts.cons.types[st.type],
    text: Texts.cons.with(optionWithParam(st.with), st.note) + (st.type === 'excluded' ? `\n${Texts.cons.stillSelectable}` : ''),
  };
}

/** „Induktion ✕ Muskelkraft“ bzw. mit „!“ für bedingte Paare. @param {MatrixConstraint} c */
function pairLabel(c) {
  const a = optionRef(c.a);
  const b = optionRef(c.b);
  return `${a ? a.text : '?'} ${c.type === 'excluded' ? '✕' : '!'} ${b ? b.text : '?'}`;
}

/** Kleines Kennzeichen „⚠ n“ für Konzepte mit unverträglichen Paaren. @param {MatrixConcept} c */
function conflictPill(c) {
  const n = Consistency.conflicts(state, c).excluded.length;
  return n ? h('span', { class: 'cons-pill excluded', title: Texts.cons.conceptConflicts(n) }, `⚠ ${n}`) : null;
}

/** Kasten in der Zusammenfassung: Unverträglichkeiten und bedingte Paare des Konzepts. @param {MatrixConcept} c */
function conflictBox(c) {
  const { excluded, conditional } = Consistency.conflicts(state, c);
  if (!excluded.length && !conditional.length) return null;
  /** @param {MatrixConstraint} x */
  const line = x => h('li', null,
    h('span', null, optionWithParam(x.a)), ` ${x.type === 'excluded' ? '✕' : '+'} `, h('span', null, optionWithParam(x.b)),
    x.note ? h('i', null, x.note) : null);
  return h('div', { class: `cons-box${excluded.length ? '' : ' is-conditional'}`, role: 'note' },
    excluded.length ? [h('strong', null, `⚠ ${Texts.cons.conflicts(excluded.length)}`), h('ul', null, excluded.map(line))] : null,
    conditional.length ? h('div', { class: 'cons-box-cond' },
      h('strong', null, `! ${Texts.cons.types.conditional}`), h('ul', null, conditional.map(line))) : null);
}

/**
 * Begründungen von Paaren, die auf „verträglich“ gesetzt wurden – damit sie nicht verloren gehen,
 * wenn das Paar (z. B. beim Durchschalten) wieder bedingt oder unverträglich wird.
 * @type {Map<string, string>}
 */
const keptNotes = new Map();

/**
 * Verträglichkeit eines Paars setzen (mit Verlauf); merkt bzw. übernimmt die Begründung.
 * @param {string} a @param {string} b @param {MatrixConstraintType | null} type
 */
function setPair(a, b, type) {
  const k = Consistency.key(a, b);
  mutate(m => {
    const before = Consistency.get(m, a, b);
    if (!type && before && before.note) keptNotes.set(k, before.note);
    Ops.setConstraint(m, a, b, type);
    const after = type ? Consistency.get(m, a, b) : null;
    if (after && !after.note && keptNotes.has(k)) {
      after.note = /** @type {string} */ (keptNotes.get(k));
      keptNotes.delete(k);
    }
  });
}

// ---------- Pflege an der Ausprägung (Popover im Bearbeiten-Modus) ----------

/** Ausprägung, deren Verträglichkeiten das Popover gerade zeigt, sonst `null`. @type {string | null} */
let consPopFor = null;

/** Zähler unter dem Text einer Ausprägung (öffnet ebenfalls das Popover). @param {MatrixOption} o */
function constraintCount(o) {
  const n = Consistency.countFor(state, o.id);
  if (!n.excluded && !n.conditional) return null;
  return h('button', {
    type: 'button', class: 'cons-count', title: Texts.cons.countTitle(n.excluded, n.conditional),
    'aria-label': `${Texts.cons.edit} – ${Texts.cons.countTitle(n.excluded, n.conditional)}`,
    onclick: e => openConsPop(o.id, e.currentTarget),
  },
  n.excluded ? h('span', { class: 'cons-pill excluded' }, `⊘ ${n.excluded}`) : null,
  n.conditional ? h('span', { class: 'cons-pill conditional' }, `! ${n.conditional}`) : null);
}

/** Knopf in der Werkzeugleiste der Ausprägung. @param {MatrixOption} o */
function constraintButton(o) {
  const n = Consistency.countFor(state, o.id);
  const btn = iconBtn('ban', Texts.cons.edit, e => openConsPop(o.id, /** @type {HTMLElement} */ (e.currentTarget)), { active: n.excluded + n.conditional > 0 });
  btn.dataset.consBtn = o.id;
  return btn;
}

/** @param {string} oid @param {HTMLElement} anchor */
function openConsPop(oid, anchor) {
  consPopFor = oid;
  const pop = $('#consPop');
  renderConsPop();
  pop.hidden = false;
  // Rechts neben der Zelle (sonst links), etwas nach oben versetzt; scrollt mit der Seite
  const cell = anchor.closest('.opt-cell') || anchor;
  placeNear(pop, cell.getBoundingClientRect(), { side: 'right', gap: 8, shift: -40, page: true });
  $('.cons-pop-close', pop).focus();
}

function closeConsPop() {
  if (consPopFor == null) return;
  const oid = consPopFor;
  consPopFor = null;
  $('#consPop').hidden = true;
  // Fokus zurück zur Zelle der Ausprägung
  const cell = $(`.opt-cell.edit[data-oid="${CSS.escape(oid)}"]`);
  if (cell) ($('.cons-count', cell) || $('textarea', cell)).focus();
}

/**
 * Drei Schalter (verträglich, bedingt, unverträglich) für ein Paar.
 * @param {string} a @param {string} b @param {(type: MatrixConstraintType | null) => void} onSet
 */
function constraintSwitch(a, b, onSet) {
  const current = Consistency.get(state, a, b);
  const value = current ? current.type : 'ok';
  const ra = optionRef(a);
  const rb = optionRef(b);
  return h('span', { class: 'cons-switch', role: 'group', 'aria-label': Texts.cons.cellLabel(ra ? ra.text : '', rb ? rb.text : '', Texts.cons.states[value]) },
    /** @type {Array<'ok' | MatrixConstraintType>} */ (['ok', 'conditional', 'excluded']).map(v => h('button', {
      type: 'button', class: `cons-state ${v}`, 'aria-pressed': String(v === value),
      title: Texts.cons.stateTitles[v],
      'aria-label': Texts.cons.setLabel(Texts.cons.stateTitles[v], ra ? ra.text : '', rb ? rb.text : ''),
      onclick: () => { if (v !== value) onSet(v === 'ok' ? null : v); },
    }, v === 'ok' ? '✓' : v === 'conditional' ? '!' : '✕')));
}

/** Begründung eines Paars (nur, wenn es nicht verträglich ist). @param {MatrixConstraint} c */
function constraintNote(c) {
  const ra = optionRef(c.a);
  const rb = optionRef(c.b);
  const input = h('input', {
    type: 'text', class: 'cons-note', value: c.note, placeholder: Texts.cons.notePlaceholder,
    'aria-label': Texts.cons.noteLabel(ra ? ra.text : '', rb ? rb.text : ''),
    dataset: { fid: `cons:${Consistency.key(c.a, c.b)}` },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });
  bindField(input, v => { c.note = v; });
  return input;
}

/** Popover neu aufbauen (nach jeder Änderung; Fokus und Bildlaufposition bleiben erhalten). */
function renderConsPop() {
  const pop = $('#consPop');
  const oid = consPopFor;
  const ref = oid ? optionRef(oid) : null;
  if (!oid || !ref || prefs.mode !== 'edit') {
    if (consPopFor != null) { consPopFor = null; pop.hidden = true; }
    return;
  }
  const others = state.parameters.map((p, pi) => ({ p, pi })).filter(({ p }) => p.id !== ref.p.id && p.options.length);
  const set = (/** @type {string} */ other) => (/** @type {MatrixConstraintType | null} */ type) => setPair(oid, other, type);
  rebuild(pop,
    h('div', { class: 'cons-pop-head' },
      h('div', null,
        h('h3', { id: 'consPopTitle' }, Texts.cons.popTitle(ref.text)),
        h('p', null, Texts.cons.popHint(ref.param))),
      iconBtn('x', Texts.ui.close, closeConsPop, { small: true }),
    ),
    h('div', { class: 'cons-pop-list', dataset: { scroll: 'list' } },
      others.length ? others.map(({ p, pi }) => h('section', null,
        h('h4', null, Model.parameterLabel(p, pi)),
        p.options.map((o, oi) => {
          const c = Consistency.get(state, oid, o.id);
          return h('div', { class: `cons-row-item${c ? ` is-${c.type}` : ''}` },
            h('span', { class: 'cons-row-text' }, o.text.trim() || Texts.fallback.emptyOption(oi + 1)),
            constraintSwitch(oid, o.id, set(o.id)),
            c ? constraintNote(c) : null);
        }))) : h('p', { class: 'summary-empty' }, Texts.cons.noOthers)),
    h('div', { class: 'cons-pop-foot' },
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => { closeConsPop(); openConsDialog(); } }, Texts.ui.constraintsButton)));
  $('.icon-btn', $('.cons-pop-head', pop)).classList.add('cons-pop-close');
}

// ---------- Verträglichkeitsmatrix (Dialog) ----------

/** Im Dialog gewähltes Paar. @type {{ a: string, b: string } | null} */
let consSelected = null;

function openConsDialog() {
  consSelected = null;
  $('#consBody').replaceChildren(); // beim Öffnen immer frisch aufbauen (z. B. andere Matrix)
  renderConsDialog();
  openDialog($('#consDialog'));
}

/** Ausprägungstext oder Ersatzname. @param {MatrixOption} o @param {number} oi */
const optText = (o, oi) => o.text.trim() || Texts.fallback.emptyOption(oi + 1);

/** Merkmal der Tabellenstruktur: Parameter, Ausprägungen und ihre Beschriftungen. */
function consGridSignature() {
  return JSON.stringify(state.parameters.map((p, pi) => [p.id, Model.parameterLabel(p, pi), p.options.map((o, oi) => [o.id, optText(o, oi)])]));
}

/**
 * Dialog aktualisieren, falls offen. Bleibt die Struktur gleich (z. B. nach einem Klick auf ein
 * Feld), ändern sich nur Klassen und Symbole der Felder – kein Neuaufbau der großen Tabelle.
 */
function renderConsDialog() {
  const body = $('#consBody');
  const P = state.parameters.map((p, pi) => ({ p, pi })).filter(({ p }) => p.options.length);
  if (P.length < 2) {
    replaceWith(body, h('p', { class: 'summary-empty' }, Texts.cons.tooFew));
    $('#consSummary').textContent = '';
    return;
  }
  if (consSelected && (!optionRef(consSelected.a) || !optionRef(consSelected.b))) consSelected = null;
  const table = $('.cons-grid', body);
  const sig = consGridSignature();
  if (table && table.dataset.sig === sig) updateConsGrid(table);
  else buildConsGrid(body, P, sig);
  rebuild($('#consDetail'), consDetail());

  const total = state.parameters.reduce((n, p) => n * BigInt(p.options.length), 1n);
  const ok = Consistency.countConsistent(state);
  $('#consSummary').textContent = Texts.cons.summary(state.constraints.length, formatCount(total).text, ok == null ? Texts.cons.notCountable : formatCount(ok).text);
}

/**
 * Dreiecksmatrix neu aufbauen: Zeilen = Ausprägungen der Parameter 2…n, Spalten = 1…n−1.
 * Jedes Feld ist eine Zelle `td[data-pair]` (Bedienung per Klick/Tastatur über die Tabelle).
 * @param {HTMLElement} body @param {Array<{ p: MatrixParameter, pi: number }>} P @param {string} sig
 */
function buildConsGrid(body, P, sig) {
  const cols = P.slice(0, -1);
  const rows = P.slice(1);
  const head = h('thead', null,
    h('tr', null, h('th', { class: 'corner', colspan: '2', rowspan: '2' }),
      cols.map(({ p, pi }) => h('th', { class: 'cg-param', colspan: String(p.options.length), scope: 'colgroup' }, Model.parameterLabel(p, pi)))),
    h('tr', null, cols.flatMap(({ p }) => p.options.map((o, oi) => h('th', { class: `cg-opt${oi === 0 ? ' grp' : ''}`, scope: 'col' }, h('span', null, optText(o, oi)))))));
  const tbody = h('tbody', null, rows.flatMap(({ p: rp, pi: rpi }, ri) => rp.options.map((ro, roi) => {
    let col = 0;
    return h('tr', { class: roi === 0 ? 'grp' : null },
      roi === 0 ? h('th', { class: 'rg-param', rowspan: String(rp.options.length), scope: 'rowgroup' }, Model.parameterLabel(rp, rpi)) : null,
      h('th', { class: 'rg-opt', scope: 'row' }, optText(ro, roi)),
      cols.flatMap(({ p: cp }, ci) => cp.options.map((co, coi) => {
        const base = coi === 0 ? 'grp' : '';
        const c = col++;
        if (ci > ri) return h('td', { class: `na ${base}` });
        return h('td', {
          role: 'gridcell', dataset: { pair: Consistency.key(ro.id, co.id), a: ro.id, b: co.id, base, col: String(c), names: JSON.stringify([optText(ro, roi), optText(co, coi)]) },
        });
      })));
  })));
  // Feste Spaltenbreiten (siehe CSS): Der Browser muss nicht jede der vielen Zellen vermessen
  const colgroup = h('colgroup', null,
    h('col', { class: 'c-param' }), h('col', { class: 'c-opt' }),
    cols.flatMap(({ p }) => p.options.map(() => h('col', { class: 'c-cell' }))));
  const table = h('table', { class: 'cons-grid', role: 'grid', 'aria-label': Texts.ui.constraintsHeading, dataset: { sig } }, colgroup, head, tbody);
  replaceWith(body, h('div', { class: 'cons-grid-wrap' }, table), h('div', { id: 'consDetail' }));
  updateConsGrid(table);
}

/** Klassen, Symbole und Beschriftungen aller Felder nach dem aktuellen Stand setzen. @param {HTMLElement} table */
function updateConsGrid(table) {
  const selKey = consSelected ? Consistency.key(consSelected.a, consSelected.b) : null;
  let focusable = /** @type {HTMLElement | null} */ (null);
  for (const td of $$('td[data-pair]', table)) {
    const { a, b, base, pair } = td.dataset;
    const c = Consistency.get(state, /** @type {string} */ (a), /** @type {string} */ (b));
    const type = c ? c.type : 'ok';
    const selected = pair === selKey;
    const cls = `${type} ${base}${selected ? ' sel' : ''}`;
    if (td.className !== cls) td.className = cls;
    const symbol = type === 'excluded' ? '✕' : type === 'conditional' ? '!' : '';
    if (td.textContent !== symbol) td.textContent = symbol;
    const [na, nb] = JSON.parse(/** @type {string} */ (td.dataset.names));
    td.setAttribute('aria-label', Texts.cons.cellLabel(na, nb, Texts.cons.states[type]));
    td.setAttribute('aria-selected', String(selected));
    td.title = c && c.note ? c.note : Texts.cons.stateTitles[type];
    if (selected) focusable = td;
  }
  // Ein Tab-Stopp für die ganze Matrix: das gewählte Feld, sonst das erste
  const current = $('td[tabindex="0"]', table);
  const target = focusable || current || $('td[data-pair]', table);
  if (current && current !== target) current.setAttribute('tabindex', '-1');
  if (target) target.setAttribute('tabindex', '0');
}

/** Feld umschalten (Doppelklick, Enter, Leertaste): verträglich → bedingt → unverträglich → verträglich. @param {HTMLElement} td */
function cycleConsCell(td) {
  const { a, b } = /** @type {{ a: string, b: string }} */ (td.dataset);
  const c = Consistency.get(state, a, b);
  const next = !c ? 'conditional' : c.type === 'conditional' ? 'excluded' : null;
  consSelected = { a, b };
  setPair(a, b, next);
  const again = $(`#consBody td[data-pair="${CSS.escape(Consistency.key(a, b))}"]`);
  if (again) again.focus();
}

/** Feld auswählen (ohne es zu ändern): Details rechts zeigen. @param {HTMLElement} td */
function selectConsCell(td) {
  const { a, b } = /** @type {{ a: string, b: string }} */ (td.dataset);
  consSelected = { a, b };
  updateConsGrid(/** @type {HTMLElement} */ (td.closest('table')));
  rebuild($('#consDetail'), consDetail());
  td.focus();
}

/** Pfeiltasten: zum nächsten Feld in der Richtung (leere Bereiche werden übersprungen). @param {HTMLElement} td @param {string} dir */
function moveConsFocus(td, dir) {
  const row = /** @type {HTMLTableRowElement} */ (td.parentElement);
  const col = Number(td.dataset.col);
  /** @type {HTMLElement | null} */
  let target = null;
  if (dir === 'ArrowLeft' || dir === 'ArrowRight') {
    const cells = $$('td[data-pair]', row);
    target = cells[cells.indexOf(td) + (dir === 'ArrowLeft' ? -1 : 1)] || null;
  } else {
    let r = /** @type {HTMLElement | null} */ (dir === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling);
    while (r && !target) {
      target = $(`td[data-pair][data-col="${col}"]`, r);
      r = /** @type {HTMLElement | null} */ (dir === 'ArrowUp' ? r.previousElementSibling : r.nextElementSibling);
    }
  }
  if (!target) return;
  selectConsCell(target);
}

/** Detailbereich zum gewählten Paar: Verträglichkeit, Begründung, betroffene Konzepte. */
function consDetail() {
  if (!consSelected) return h('div', { class: 'cons-detail' }, h('p', { class: 'summary-empty' }, Texts.cons.detailEmpty));
  const { a, b } = consSelected;
  const ra = optionRef(a);
  const rb = optionRef(b);
  if (!ra || !rb) return h('div', { class: 'cons-detail' });
  const c = Consistency.get(state, a, b);
  const affected = state.concepts.filter(x => Object.values(x.selections).includes(a) && Object.values(x.selections).includes(b));
  return h('div', { class: 'cons-detail' },
    h('h3', null, `${ra.text} ${c && c.type === 'excluded' ? '✕' : c ? '!' : '·'} ${rb.text}`),
    h('p', { class: 'cons-detail-params' }, `${ra.param} · ${rb.param}`),
    constraintSwitch(a, b, type => setPair(a, b, type)),
    c ? h('label', { class: 'cons-detail-note' }, Texts.cons.noteHeading, constraintNote(c)) : null,
    h('p', { class: 'cons-detail-affects' },
      affected.length ? Texts.cons.affects(affected.map(x => Model.nameOrUnnamed(x)).join(', ')) : Texts.cons.affectsNone));
}

/** Nach jeder Änderung: offenes Popover bzw. offenen Dialog aktualisieren. */
function refreshConstraintEditors() {
  if (consPopFor != null) renderConsPop();
  if ($('#consDialog').open) renderConsDialog();
}

function initConstraints() {
  const body = $('#consBody');
  // Klick wählt aus (Änderung rechts im Detailbereich), Doppelklick schaltet direkt weiter
  body.addEventListener('click', e => {
    const td = /** @type {HTMLElement} */ (e.target).closest('td[data-pair]');
    if (td) selectConsCell(/** @type {HTMLElement} */ (td));
  });
  body.addEventListener('dblclick', e => {
    const td = /** @type {HTMLElement} */ (e.target).closest('td[data-pair]');
    if (td) cycleConsCell(/** @type {HTMLElement} */ (td));
  });
  body.addEventListener('keydown', e => {
    const td = /** @type {HTMLElement} */ (e.target).closest('td[data-pair]');
    if (!td) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleConsCell(/** @type {HTMLElement} */ (td)); }
    else if (e.key.startsWith('Arrow')) { e.preventDefault(); moveConsFocus(/** @type {HTMLElement} */ (td), e.key); }
  });
  $('#consClose').addEventListener('click', () => closeDialog($('#consDialog')));
  $('#consDone').addEventListener('click', () => closeDialog($('#consDialog')));
  $('#consOpenBtn').addEventListener('click', openConsDialog);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && consPopFor != null) { e.preventDefault(); closeConsPop(); }
  });
  document.addEventListener('mousedown', e => {
    if (consPopFor == null) return;
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.closest('#consPop, .cons-count, [data-cons-btn]')) closeConsPop();
  });
}
