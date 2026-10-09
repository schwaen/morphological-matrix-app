/*
 * Verträglichkeiten in der Oberfläche: Texte zu Konflikten und Hinweisen, die Pflege direkt an
 * einer Ausprägung (Popover, Bearbeiten-Modus) und die Übersicht als Verträglichkeitsmatrix
 * (Dialog „Verträglichkeiten“). Die Logik steht in js/consistency.js.
 */
import { signal } from '@preact/signals';
import { Component, render as mount } from 'preact';
import { Consistency } from '../consistency.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { fieldProps, mutate, prefs, state, useMatrix } from './core.js';
import { consistentCount } from './count.js';
import { $, closeDialog, openDialog, placeNear } from './dom.jsx';
import { IconButton } from './components.jsx';
import { formatCount } from './render-panels.jsx';

/** Ausprägung samt Parameter und Anzeigetexten zu einer ID. @param {string} oid */
function optionRef(oid) {
  const r = Model.findOption(state, oid);
  return r && { ...r, text: optText(r.o, r.oi), param: Model.parameterLabel(r.p, r.pi) };
}

/** Ausprägungstext oder Ersatzname. @param {MatrixOption} o @param {number} oi */
const optText = (o, oi) => o.text.trim() || Texts.fallback.emptyOption(oi + 1);

/** „Induktion (Wassererwärmung)“ @param {string} oid */
function optionWithParam(oid) {
  const r = optionRef(oid);
  return r ? Texts.cons.withParam(r.text, r.param) : '';
}

/** Anderes Ende eines Paars. @param {MatrixConstraint} c @param {string} oid */
const otherOf = (c, oid) => (c.a === oid ? c.b : c.a);

/** Hinweis für eine gewählte Ausprägung mit unverträglichen Partnern. @param {string} oid @param {MatrixConstraint[]} list */
export function conflictText(oid, list) {
  return {
    type: 'excluded',
    label: Texts.cons.conflictLabel,
    text: list.map(c => Texts.cons.excludedWith(optionWithParam(otherOf(c, oid)), c.note)).join('\n'),
  };
}

/** Hinweis für eine nicht gewählte Ausprägung. @param {{ type: MatrixConstraintType, with: string, note: string }} st */
export function statusText(st) {
  return {
    type: st.type,
    label: Texts.cons.types[st.type],
    text: Texts.cons.with(optionWithParam(st.with), st.note) + (st.type === 'excluded' ? `\n${Texts.cons.stillSelectable}` : ''),
  };
}

/** „Induktion ✕ Muskelkraft“ bzw. mit „!“ für bedingte Paare. @param {MatrixConstraint} c */
export function pairLabel(c) {
  const a = optionRef(c.a);
  const b = optionRef(c.b);
  return `${a ? a.text : '?'} ${c.type === 'excluded' ? '✕' : '!'} ${b ? b.text : '?'}`;
}

/** Kleines Kennzeichen „⚠ n“ für Konzepte mit unverträglichen Paaren. @param {{ c: MatrixConcept }} props */
export function ConflictPill({ c }) {
  const n = Consistency.conflicts(state, c).excluded.length;
  return n ? <span class="cons-pill excluded" title={Texts.cons.conceptConflicts(n)}>{`⚠ ${n}`}</span> : null;
}

/** Kasten in der Zusammenfassung: Unverträglichkeiten und bedingte Paare des Konzepts. @param {{ c: MatrixConcept }} props */
export function ConflictBox({ c }) {
  const { excluded, conditional } = Consistency.conflicts(state, c);
  if (!excluded.length && !conditional.length) return null;
  /** @param {MatrixConstraint} x */
  const line = x => (
    <li key={Consistency.key(x.a, x.b)}>
      <span>{optionWithParam(x.a)}</span>{` ${x.type === 'excluded' ? '✕' : '+'} `}<span>{optionWithParam(x.b)}</span>
      {x.note ? <i>{x.note}</i> : null}
    </li>
  );
  return (
    <div class={`cons-box${excluded.length ? '' : ' is-conditional'}`} role="note">
      {excluded.length ? <><strong>{`⚠ ${Texts.cons.conflicts(excluded.length)}`}</strong><ul>{excluded.map(line)}</ul></> : null}
      {conditional.length ? (
        <div class="cons-box-cond"><strong>{`! ${Texts.cons.types.conditional}`}</strong><ul>{conditional.map(line)}</ul></div>
      ) : null}
    </div>
  );
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

// ---------- Bausteine ----------

/**
 * Drei Schalter (verträglich, bedingt, unverträglich) für ein Paar.
 * @param {{ a: string, b: string, onSet: (type: MatrixConstraintType | null) => void }} props
 */
function ConstraintSwitch({ a, b, onSet }) {
  const current = Consistency.get(state, a, b);
  const value = current ? current.type : 'ok';
  const ta = optionRef(a)?.text ?? '';
  const tb = optionRef(b)?.text ?? '';
  return (
    <span class="cons-switch" role="group" aria-label={Texts.cons.cellLabel(ta, tb, Texts.cons.states[value])}>
      {/** @type {Array<'ok' | MatrixConstraintType>} */ (['ok', 'conditional', 'excluded']).map(v => (
        <button
          type="button" key={v} class={`cons-state ${v}`} aria-pressed={v === value}
          title={Texts.cons.stateTitles[v]} aria-label={Texts.cons.setLabel(Texts.cons.stateTitles[v], ta, tb)}
          onClick={() => { if (v !== value) onSet(v === 'ok' ? null : v); }}
        >{v === 'ok' ? '✓' : v === 'conditional' ? '!' : '✕'}</button>
      ))}
    </span>
  );
}

/** Begründung eines Paars (nur, wenn es nicht verträglich ist). @param {{ c: MatrixConstraint }} props */
function ConstraintNote({ c }) {
  const ta = optionRef(c.a)?.text ?? '';
  const tb = optionRef(c.b)?.text ?? '';
  return (
    <input
      type="text" class="cons-note" value={c.note} placeholder={Texts.cons.notePlaceholder}
      aria-label={Texts.cons.noteLabel(ta, tb)} data-fid={`cons:${Consistency.key(c.a, c.b)}`}
      onKeyDown={e => { if (e.key === 'Enter') /** @type {HTMLElement} */ (e.currentTarget).blur(); }}
      {...fieldProps(v => { c.note = v; })}
    />
  );
}

// ---------- Pflege an der Ausprägung (Popover im Bearbeiten-Modus) ----------

/** Ausprägung, deren Verträglichkeiten das Popover gerade zeigt, sonst `null`. */
const consPopFor = signal(/** @type {string | null} */ (null));

/** Zähler unter dem Text einer Ausprägung (öffnet ebenfalls das Popover). @param {{ o: MatrixOption }} props */
export function ConstraintCount({ o }) {
  const n = Consistency.countFor(state, o.id);
  if (!n.excluded && !n.conditional) return null;
  const title = Texts.cons.countTitle(n.excluded, n.conditional);
  return (
    <button
      type="button" class="cons-count" title={title} aria-label={`${Texts.cons.edit} – ${title}`}
      onClick={e => openConsPop(o.id, /** @type {HTMLElement} */ (e.currentTarget))}
    >
      {n.excluded ? <span class="cons-pill excluded">{`⊘ ${n.excluded}`}</span> : null}
      {n.conditional ? <span class="cons-pill conditional">{`! ${n.conditional}`}</span> : null}
    </button>
  );
}

/** Knopf in der Werkzeugleiste der Ausprägung. @param {{ o: MatrixOption }} props */
export function ConstraintButton({ o }) {
  const n = Consistency.countFor(state, o.id);
  return (
    <IconButton
      icon="ban" label={Texts.cons.edit} active={n.excluded + n.conditional > 0} data-cons-btn={o.id}
      onClick={e => openConsPop(o.id, /** @type {HTMLElement} */ (e.currentTarget))}
    />
  );
}

/** @param {string} oid @param {HTMLElement} anchor */
export function openConsPop(oid, anchor) {
  consPopFor.value = oid;
  const pop = $('#consPop');
  pop.hidden = false;
  // Rechts neben der Zelle (sonst links), etwas nach oben versetzt; scrollt mit der Seite
  placeNear(pop, anchor.closest('.opt-cell') || anchor, { side: 'right', gap: 8, shift: -40 });
  $('.cons-pop-close', pop).focus();
}

function closeConsPop() {
  const oid = consPopFor.value;
  if (oid == null) return;
  consPopFor.value = null;
  $('#consPop').hidden = true;
  // Fokus zurück zur Zelle der Ausprägung
  const cell = $(`.opt-cell.edit[data-oid="${CSS.escape(oid)}"]`);
  if (cell) ($('.cons-count', cell) || $('textarea', cell)).focus();
}

/** Inhalt des Popovers: alle Ausprägungen der anderen Parameter mit Schaltern und Begründung. */
function ConsPop() {
  useMatrix();
  const oid = consPopFor.value;
  const ref = oid ? optionRef(oid) : null;
  if (!oid || !ref || prefs.mode !== 'edit') {
    if (oid != null) queueMicrotask(closeConsPop); // Ausprägung gelöscht oder Modus gewechselt
    return null;
  }
  const others = state.parameters.map((p, pi) => ({ p, pi })).filter(({ p }) => p.id !== ref.p.id && p.options.length);
  return (
    <>
      <div class="cons-pop-head">
        <div>
          <h3 id="consPopTitle">{Texts.cons.popTitle(ref.text)}</h3>
          <p>{Texts.cons.popHint(ref.param)}</p>
        </div>
        <IconButton icon="x" label={Texts.ui.close} onClick={closeConsPop} class="cons-pop-close" />
      </div>
      <div class="cons-pop-list">
        {others.length ? others.map(({ p, pi }) => (
          <section key={p.id}>
            <h4>{Model.parameterLabel(p, pi)}</h4>
            {p.options.map((o, oi) => {
              const c = Consistency.get(state, oid, o.id);
              return (
                <div key={o.id} class={`cons-row-item${c ? ` is-${c.type}` : ''}`}>
                  <span class="cons-row-text">{optText(o, oi)}</span>
                  <ConstraintSwitch a={oid} b={o.id} onSet={type => setPair(oid, o.id, type)} />
                  {c ? <ConstraintNote c={c} /> : null}
                </div>
              );
            })}
          </section>
        )) : <p class="summary-empty">{Texts.cons.noOthers}</p>}
      </div>
      <div class="cons-pop-foot">
        <button type="button" class="btn btn-small" onClick={() => { closeConsPop(); openConsDialog(); }}>{Texts.ui.constraintsButton}</button>
      </div>
    </>
  );
}

// ---------- Verträglichkeitsmatrix (Dialog) ----------

/** Im Dialog gewähltes Paar. */
const consSelected = signal(/** @type {{ a: string, b: string } | null} */ (null));
/** Dialog geöffnet (nur dann wird die – bei großen Matrizen umfangreiche – Tabelle gezeichnet). */
const consOpen = signal(false);

export function openConsDialog() {
  consSelected.value = null;
  consOpen.value = true;
  openDialog($('#consDialog'));
}

/** Zusammenfassung über der Matrix: Zahl der Paare und der widerspruchsfreien Kombinationen. */
function ConsSummary() {
  useMatrix();
  if (!consOpen.value) return null;
  const P = state.parameters.filter(p => p.options.length);
  if (P.length < 2) return null;
  const total = state.parameters.reduce((n, p) => n * BigInt(p.options.length), 1n);
  const { value: ok } = consistentCount(state);
  const okText = ok === undefined ? '…' : ok == null ? Texts.cons.notCountable : formatCount(ok).text;
  return <>{Texts.cons.summary(state.constraints.length, formatCount(total).text, okText)}</>;
}

/** Inhalt des Dialogs: Dreiecksmatrix und Detailbereich zum gewählten Paar. */
function ConsBody() {
  useMatrix();
  if (!consOpen.value) return null;
  const P = state.parameters.map((p, pi) => ({ p, pi })).filter(({ p }) => p.options.length);
  if (P.length < 2) return <p class="summary-empty">{Texts.cons.tooFew}</p>;
  const sel = consSelected.value;
  const selected = sel && optionRef(sel.a) && optionRef(sel.b) ? sel : null;
  return (
    <>
      <div class="cons-grid-wrap"><ConsGrid P={P} selected={selected} /></div>
      <div id="consDetail"><ConsDetail selected={selected} /></div>
    </>
  );
}

/**
 * Dreiecksmatrix: Zeilen = Ausprägungen der Parameter 2…n, Spalten = 1…n−1. Jedes Feld ist eine
 * Zelle `td[data-pair]`; Klick wählt aus, Doppelklick bzw. Enter/Leertaste schaltet weiter,
 * Pfeiltasten wandern von Feld zu Feld (ein Tab-Stopp für die ganze Matrix).
 * @param {{ P: Array<{ p: MatrixParameter, pi: number }>, selected: { a: string, b: string } | null }} props
 */
function ConsGrid({ P, selected }) {
  const cols = P.slice(0, -1);
  const rows = P.slice(1);
  const selKey = selected ? Consistency.key(selected.a, selected.b) : null;
  // Tab-Stopp: das gewählte Feld, sonst das erste
  const firstKey = Consistency.key(rows[0].p.options[0].id, cols[0].p.options[0].id);
  const tabKey = selKey || firstKey;
  /** @param {Event} e */
  const cellOf = e => /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('td[data-pair]'));
  return (
    <table
      class="cons-grid" role="grid" aria-label={Texts.ui.constraintsHeading}
      onClick={e => { const td = cellOf(e); if (td) selectCell(td); }}
      onDblClick={e => { const td = cellOf(e); if (td) cycleCell(td); }}
      onKeyDown={e => {
        const td = cellOf(e);
        if (!td) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleCell(td); }
        else if (e.key.startsWith('Arrow')) { e.preventDefault(); moveFocus(td, e.key); }
      }}
    >
      {/* Feste Spaltenbreiten (siehe CSS): Der Browser muss nicht jede der vielen Zellen vermessen */}
      <colgroup>
        <col class="c-param" /><col class="c-opt" />
        {cols.flatMap(({ p }) => p.options.map(o => <col key={o.id} class="c-cell" />))}
      </colgroup>
      <thead>
        <tr>
          <th class="corner" colSpan={2} rowSpan={2} />
          {cols.map(({ p, pi }) => <th key={p.id} class="cg-param" colSpan={p.options.length} scope="colgroup">{Model.parameterLabel(p, pi)}</th>)}
        </tr>
        <tr>
          {cols.flatMap(({ p }) => p.options.map((o, oi) => (
            <th key={o.id} class={`cg-opt${oi === 0 ? ' grp' : ''}`} scope="col"><span>{optText(o, oi)}</span></th>
          )))}
        </tr>
      </thead>
      <tbody>
        {rows.flatMap(({ p: rp, pi: rpi }, ri) => rp.options.map((ro, roi) => {
          // Felder der Zeile als Daten; die Zeile zeichnet nur neu, wenn sich daran etwas ändert
          /** @type {ConsCell[]} */
          const cells = [];
          let col = 0;
          cols.forEach(({ p: cp }, ci) => cp.options.forEach((co, coi) => {
            const base = coi === 0 ? 'grp' : '';
            const c = col++;
            if (ci > ri) { cells.push({ id: co.id, base, na: true }); return; }
            const pair = Consistency.key(ro.id, co.id);
            const x = Consistency.get(state, ro.id, co.id);
            cells.push({
              id: co.id, base, col: c, pair, type: x ? x.type : 'ok', note: x ? x.note : '', name: optText(co, coi),
              sel: pair === selKey, tab: pair === tabKey,
            });
          }));
          const head = roi === 0 ? { label: Model.parameterLabel(rp, rpi), span: rp.options.length } : null;
          const name = optText(ro, roi);
          return <ConsRow key={ro.id} oid={ro.id} name={name} head={head} cells={cells} sig={JSON.stringify([name, head, cells])} />;
        }))}
      </tbody>
    </table>
  );
}

/**
 * Ein Feld der Verträglichkeitsmatrix (`na`: oberhalb der Diagonale, ohne Paar).
 * @typedef {{ id: string, base: string, na?: boolean, col?: number, pair?: string, type?: 'ok' | MatrixConstraintType,
 *             note?: string, name?: string, sel?: boolean, tab?: boolean }} ConsCell
 */

/**
 * Eine Zeile der Verträglichkeitsmatrix. `sig` fasst alle Angaben zusammen; ist sie unverändert,
 * überspringt Preact die Zeile (bei großen Matrizen sind das Tausende Felder).
 * @param {{ oid: string, name: string, head: { label: string, span: number } | null, cells: ConsCell[], sig: string }} props
 */
function ConsRowView({ oid, name, head, cells }) {
  return (
  <tr class={head ? 'grp' : undefined}>
    {head ? <th class="rg-param" rowSpan={head.span} scope="rowgroup">{head.label}</th> : null}
    <th class="rg-opt" scope="row">{name}</th>
    {cells.map(c => (c.na ? <td key={c.id} class={`na ${c.base}`} /> : (
      <td
        key={c.id} role="gridcell" class={`${c.type} ${c.base}${c.sel ? ' sel' : ''}`}
        data-pair={c.pair} data-a={oid} data-b={c.id} data-col={c.col}
        aria-label={Texts.cons.cellLabel(name, c.name ?? '', Texts.cons.states[c.type ?? 'ok'])}
        aria-selected={!!c.sel} tabIndex={c.tab ? 0 : -1}
        title={c.note || Texts.cons.stateTitles[c.type ?? 'ok']}
      >{c.type === 'excluded' ? '✕' : c.type === 'conditional' ? '!' : ''}</td>
    )))}
  </tr>
  );
}
/** @extends {Component<{ oid: string, name: string, head: { label: string, span: number } | null, cells: ConsCell[], sig: string }>} */
class ConsRow extends Component {
  /** @param {{ sig: string }} next */
  shouldComponentUpdate(next) { return next.sig !== this.props.sig; }
  render() { return ConsRowView(this.props); }
}

/** Feld auswählen (ohne es zu ändern): Details rechts zeigen. @param {HTMLElement} td */
function selectCell(td) {
  const { a, b } = /** @type {{ a: string, b: string }} */ (td.dataset);
  consSelected.value = { a, b };
  td.focus();
}

/** Feld umschalten: verträglich → bedingt → unverträglich → verträglich. @param {HTMLElement} td */
function cycleCell(td) {
  const { a, b } = /** @type {{ a: string, b: string }} */ (td.dataset);
  const c = Consistency.get(state, a, b);
  consSelected.value = { a, b };
  setPair(a, b, !c ? 'conditional' : c.type === 'conditional' ? 'excluded' : null);
  td.focus();
}

/** Pfeiltasten: zum nächsten Feld in der Richtung (leere Bereiche werden übersprungen). @param {HTMLElement} td @param {string} dir */
function moveFocus(td, dir) {
  const row = /** @type {HTMLTableRowElement} */ (td.parentElement);
  /** @type {HTMLElement | null} */
  let target = null;
  if (dir === 'ArrowLeft' || dir === 'ArrowRight') {
    const cells = [.../** @type {NodeListOf<HTMLElement>} */ (row.querySelectorAll('td[data-pair]'))];
    target = cells[cells.indexOf(td) + (dir === 'ArrowLeft' ? -1 : 1)] || null;
  } else {
    let r = /** @type {HTMLElement | null} */ (dir === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling);
    while (r && !target) {
      target = r.querySelector(`td[data-pair][data-col="${td.dataset.col}"]`);
      r = /** @type {HTMLElement | null} */ (dir === 'ArrowUp' ? r.previousElementSibling : r.nextElementSibling);
    }
  }
  if (target) selectCell(target);
}

/** Detailbereich zum gewählten Paar: Verträglichkeit, Begründung, betroffene Konzepte. @param {{ selected: { a: string, b: string } | null }} props */
function ConsDetail({ selected }) {
  if (!selected) return <div class="cons-detail"><p class="summary-empty">{Texts.cons.detailEmpty}</p></div>;
  const { a, b } = selected;
  const ra = optionRef(a);
  const rb = optionRef(b);
  if (!ra || !rb) return <div class="cons-detail" />;
  const c = Consistency.get(state, a, b);
  const affected = state.concepts.filter(x => Object.values(x.selections).includes(a) && Object.values(x.selections).includes(b));
  return (
    <div class="cons-detail">
      <h3>{`${ra.text} ${c && c.type === 'excluded' ? '✕' : c ? '!' : '·'} ${rb.text}`}</h3>
      <p class="cons-detail-params">{`${ra.param} · ${rb.param}`}</p>
      <ConstraintSwitch a={a} b={b} onSet={type => setPair(a, b, type)} />
      {c ? <label class="cons-detail-note">{Texts.cons.noteHeading}<ConstraintNote key={Consistency.key(a, b)} c={c} /></label> : null}
      <p class="cons-detail-affects">
        {affected.length ? Texts.cons.affects(affected.map(x => Model.nameOrUnnamed(x)).join(', ')) : Texts.cons.affectsNone}
      </p>
    </div>
  );
}

export function initConstraints() {
  mount(<ConsPop />, $('#consPop'));
  mount(<ConsBody />, $('#consBody'));
  mount(<ConsSummary />, $('#consSummary'));
  const dialog = $('#consDialog');
  dialog.addEventListener('close', () => { consOpen.value = false; });
  $('#consClose').addEventListener('click', () => closeDialog(dialog));
  $('#consDone').addEventListener('click', () => closeDialog(dialog));
  $('#consOpenBtn').addEventListener('click', openConsDialog);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && consPopFor.value != null) { e.preventDefault(); closeConsPop(); }
  });
  document.addEventListener('mousedown', e => {
    if (consPopFor.value == null) return;
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.closest('#consPop, .cons-count, [data-cons-btn]')) closeConsPop();
  });
}
