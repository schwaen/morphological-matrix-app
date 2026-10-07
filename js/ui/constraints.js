/*
 * Verträglichkeiten in der Oberfläche: Texte zu Konflikten und Hinweisen, die Pflege direkt an
 * einer Ausprägung (Popover, Bearbeiten-Modus) und die Übersicht als Verträglichkeitsmatrix
 * (Dialog „Verträglichkeiten“). Die Logik steht in js/consistency.js.
 */
'use strict';

/** Ausprägung samt Parameter zu einer ID. @param {string} oid */
function optionRef(oid) {
  for (const [pi, p] of state.parameters.entries()) {
    const oi = p.options.findIndex(o => o.id === oid);
    if (oi >= 0) {
      const o = p.options[oi];
      return { p, o, text: o.text.trim() || Texts.fallback.emptyOption(oi + 1), param: Model.parameterLabel(p, pi) };
    }
  }
  return null;
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
  // Rechts neben der Zelle, sonst links; vertikal im sichtbaren Bereich
  const cell = anchor.closest('.opt-cell') || anchor;
  const r = cell.getBoundingClientRect();
  const w = pop.offsetWidth;
  const left = r.right + 8 + w <= window.innerWidth ? r.right + 8 : Math.max(8, r.left - w - 8);
  pop.style.left = `${left + window.scrollX}px`;
  const top = Math.min(r.top - 40, window.innerHeight - pop.offsetHeight - 8);
  pop.style.top = `${Math.max(8, top) + window.scrollY}px`;
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

/** Popover neu aufbauen (nach jeder Änderung; Bildlaufposition bleibt erhalten). */
function renderConsPop() {
  const pop = $('#consPop');
  const oid = consPopFor;
  const ref = oid ? optionRef(oid) : null;
  if (!oid || !ref || prefs.mode !== 'edit') {
    if (consPopFor != null) { consPopFor = null; pop.hidden = true; }
    return;
  }
  const list = $('.cons-pop-list', pop);
  const scroll = list ? list.scrollTop : 0;
  const focusKey = document.activeElement && pop.contains(document.activeElement) ? focusKeyOf(document.activeElement) : null;
  const others = state.parameters.map((p, pi) => ({ p, pi })).filter(({ p }) => p.id !== ref.p.id && p.options.length);
  const set = (/** @type {string} */ other) => (/** @type {MatrixConstraintType | null} */ type) => mutate(m => Ops.setConstraint(m, oid, other, type));
  replaceWith(pop,
    h('div', { class: 'cons-pop-head' },
      h('div', null,
        h('h3', { id: 'consPopTitle' }, Texts.cons.popTitle(ref.text)),
        h('p', null, Texts.cons.popHint(ref.param))),
      iconBtn('x', Texts.ui.close, closeConsPop, { small: true }),
    ),
    h('div', { class: 'cons-pop-list' },
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
  const newList = $('.cons-pop-list', pop);
  if (newList) newList.scrollTop = scroll;
  restoreFocus(pop, focusKey);
}

/** Merkmal, um ein Bedienelement nach dem Neuaufbau wiederzufinden. @param {Element} el */
function focusKeyOf(el) {
  const { fid, pair } = /** @type {HTMLElement} */ (el).dataset;
  if (fid) return `[data-fid="${CSS.escape(fid)}"]`;
  if (pair) return `[data-pair="${CSS.escape(pair)}"]`;
  const label = el.getAttribute('aria-label');
  return label ? `[aria-label="${CSS.escape(label)}"]` : null;
}

/** @param {HTMLElement} root @param {string | null} sel */
function restoreFocus(root, sel) {
  if (!sel) return;
  const el = $(sel, root);
  if (el) el.focus();
}

// ---------- Verträglichkeitsmatrix (Dialog) ----------

/** Im Dialog gewähltes Paar. @type {{ a: string, b: string } | null} */
let consSelected = null;

function openConsDialog() {
  consSelected = null;
  renderConsDialog();
  openDialog($('#consDialog'));
}

/** Dialog neu aufbauen, falls offen (Bildlauf und Fokus bleiben erhalten). */
function renderConsDialog() {
  const dlg = $('#consDialog');
  const body = $('#consBody');
  const wrap = $('.cons-grid-wrap', body);
  const pos = wrap ? { top: wrap.scrollTop, left: wrap.scrollLeft } : null;
  const focusKey = document.activeElement && dlg.contains(document.activeElement) ? focusKeyOf(document.activeElement) : null;
  const P = state.parameters.map((p, pi) => ({ p, pi })).filter(({ p }) => p.options.length);
  if (P.length < 2) {
    replaceWith(body, h('p', { class: 'summary-empty' }, Texts.cons.tooFew));
    $('#consSummary').textContent = '';
    return;
  }
  if (consSelected && (!optionRef(consSelected.a) || !optionRef(consSelected.b))) consSelected = null;

  const cols = P.slice(0, -1);
  const rows = P.slice(1);
  const optText = (/** @type {MatrixOption} */ o, /** @type {number} */ oi) => o.text.trim() || Texts.fallback.emptyOption(oi + 1);
  const head = h('thead', null,
    h('tr', null, h('th', { class: 'corner', colspan: '2', rowspan: '2' }),
      cols.map(({ p, pi }) => h('th', { class: 'cg-param', colspan: String(p.options.length), scope: 'colgroup' }, Model.parameterLabel(p, pi)))),
    h('tr', null, cols.flatMap(({ p }) => p.options.map((o, oi) => h('th', { class: `cg-opt${oi === 0 ? ' grp' : ''}`, scope: 'col' }, h('span', null, optText(o, oi)))))));
  const tbody = h('tbody', null, rows.flatMap(({ p: rp, pi: rpi }, ri) => rp.options.map((ro, roi) => h('tr', { class: roi === 0 ? 'grp' : null },
    roi === 0 ? h('th', { class: 'rg-param', rowspan: String(rp.options.length), scope: 'rowgroup' }, Model.parameterLabel(rp, rpi)) : null,
    h('th', { class: 'rg-opt', scope: 'row' }, optText(ro, roi)),
    cols.flatMap(({ p: cp }, ci) => cp.options.map((co, coi) => {
      const grp = coi === 0 ? ' grp' : '';
      if (ci > ri) return h('td', { class: `na${grp}` });
      const c = Consistency.get(state, ro.id, co.id);
      const type = c ? c.type : 'ok';
      const selected = !!consSelected && Consistency.key(consSelected.a, consSelected.b) === Consistency.key(ro.id, co.id);
      return h('td', { class: `${type}${grp}${selected ? ' sel' : ''}` }, h('button', {
        type: 'button', title: c && c.note ? c.note : Texts.cons.stateTitles[type],
        'aria-label': Texts.cons.cellLabel(optText(ro, roi), optText(co, coi), Texts.cons.states[type]),
        'aria-pressed': String(selected), dataset: { pair: Consistency.key(ro.id, co.id) },
        onclick: () => {
          consSelected = { a: ro.id, b: co.id };
          const next = type === 'ok' ? 'conditional' : type === 'conditional' ? 'excluded' : null;
          mutate(m => Ops.setConstraint(m, ro.id, co.id, next));
        },
      }, type === 'excluded' ? '✕' : type === 'conditional' ? '!' : ''));
    }))))));

  replaceWith(body,
    h('div', { class: 'cons-grid-wrap' }, h('table', { class: 'cons-grid' }, head, tbody)),
    consDetail());
  const newWrap = $('.cons-grid-wrap', body);
  // Zweite Kopfspalte klebt rechts neben der ersten (deren Breite hängt von den Namen ab)
  const first = $('th.rg-param', newWrap);
  const opt = $('th.rg-opt', newWrap);
  if (first) newWrap.style.setProperty('--rg-w', `${first.offsetWidth}px`);
  // Felder beim Ansteuern (Tastatur) nicht unter den klebenden Köpfen verstecken
  newWrap.style.scrollPaddingLeft = `${(first ? first.offsetWidth : 0) + (opt ? opt.offsetWidth : 0)}px`;
  newWrap.style.scrollPaddingTop = `${$('thead', newWrap).offsetHeight}px`;
  if (pos) { newWrap.scrollTop = pos.top; newWrap.scrollLeft = pos.left; }
  restoreFocus(dlg, focusKey);

  const total = state.parameters.reduce((n, p) => n * BigInt(p.options.length), 1n);
  const ok = Consistency.countConsistent(state);
  $('#consSummary').textContent = Texts.cons.summary(state.constraints.length, formatCount(total).text, ok == null ? Texts.cons.notCountable : formatCount(ok).text);
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
    constraintSwitch(a, b, type => mutate(m => Ops.setConstraint(m, a, b, type))),
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
