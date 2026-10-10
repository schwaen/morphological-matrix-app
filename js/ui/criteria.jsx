/*
 * Nutzwert nach Kriterien: Liste der Kriterien in den Bewertungseinstellungen, Knopf und
 * Popover zur Bewertung an der Ausprägung (Bearbeiten-Modus) und die Bewertungstabelle aller
 * Ausprägungen. Mit nur einem Kriterium bleibt es beim einfachen Zahlenfeld in der Zelle.
 * Die Rechnung steht in js/evaluation.js (optionScore, conceptCriteria).
 */
import { signal } from '@preact/signals';
import { Fragment, render as mount } from 'preact';
import { Evaluation } from '../evaluation.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Icon, IconButton } from './components.jsx';
import { fieldProps, mutate, prefs, state, useMatrix } from './core.js';
import { $, closeDialog, openDialog, placeNear } from './dom.jsx';
import { NumberField } from './fields.jsx';
import { Util } from '../util.js';

/** Ausprägung, deren Popover offen ist. */
const scoreFor = signal(/** @type {string | null} */ (null));
/** Bis zu diesem Zeitpunkt löst Bildlauf kein Schließen aus (eigenes Weiterblättern scrollt). */
let keepOpenUntil = 0;
/** Bewertungstabelle geöffnet (nur dann wird sie gezeichnet). */
const tableOpen = signal(false);

/** Wert eines Kriteriums setzen bzw. (leer) entfernen. @param {MatrixOption} o @param {string} cid @param {number | null} n */
function setScore(o, cid, n) {
  if (n == null) delete o.scores[cid];
  else o.scores[cid] = n;
}

/** Feld fokussieren und den Inhalt markieren, damit Tippen ihn ersetzt. @param {HTMLInputElement | null} el */
function focusField(el) {
  if (!el) return;
  el.focus();
  el.select();
}

/** Ob die Bewertung nach mehreren Kriterien aktiv ist. @param {Matrix} m */
export const multiCriteria = m => m.settings.utility && m.settings.criteria.length > 1;

// ---------- Kriterien (Bewertungseinstellungen) ----------

function addCriterion() {
  const list = state.settings.criteria;
  // Neues Kriterium zählt so viel wie ein durchschnittliches
  const weight = Math.round(list.reduce((s, c) => s + c.weight, 0) / list.length) || 100;
  const id = Util.uid();
  mutate(m => Ops.addCriterion(m, { id, name: '', weight }));
  /** @type {HTMLElement | null} */ (document.querySelector(`[data-criterion="${CSS.escape(id)}"]`))?.focus();
}

/** @param {MatrixCriterion} c */
function deleteCriterion(c) {
  const used = state.parameters.some(p => p.options.some(o => o.scores[c.id] != null));
  if (used && !window.confirm(Texts.criteria.deleteConfirm(Model.criterionLabel(c)))) return;
  mutate(m => Ops.deleteCriterion(m, c.id));
}

/** Kriterien mit Gewicht (Regler, Anteil in %) – unter „Nutzwert“ in den Bewertungseinstellungen. */
export function CriteriaEditor() {
  const m = useMatrix();
  const shares = Evaluation.criterionShares(m);
  const many = shares.length > 1;
  return (
    <div class="criteria">
      <div class="criteria-list">
        <span class="criteria-h">{Texts.criteria.name}</span>
        <span class="criteria-h">{Texts.criteria.weight}</span>
        <span />
        <span />
        {shares.map(({ c, share }, i) => (
          <Fragment key={c.id}>
            <input
              type="text" class="criteria-name" value={c.name} placeholder={Texts.fallback.criterion}
              aria-label={Texts.criteria.nameLabel(i + 1)} data-criterion={c.id} {...fieldProps(v => { c.name = v; })}
            />
            <input
              type="range" class="criteria-weight" min="0" max="100" step="5" value={c.weight} disabled={!many}
              aria-label={Texts.criteria.weightLabel(Model.criterionLabel(c))} {...fieldProps(v => { c.weight = Number(v); })}
            />
            <span class="criteria-share">{Util.formatPercent(share)}</span>
            <IconButton icon="trash" label={Texts.criteria.delete} danger disabled={!many} onClick={() => deleteCriterion(c)} />
          </Fragment>
        ))}
      </div>
      <div class="criteria-foot">
        <button type="button" class="btn btn-small" id="addCriterionBtn" onClick={addCriterion}><Icon name="plus" /><span>{Texts.criteria.add}</span></button>
        {many ? <button type="button" class="btn btn-small" id="scoreTableBtn" onClick={openScoreTable}>{Texts.criteria.openTable}</button> : null}
      </div>
      {many ? <p class="setting-desc">{Texts.criteria.sumHint}</p> : null}
    </div>
  );
}

// ---------- Knopf und Popover an der Ausprägung ----------

/**
 * Nutzwert einer Ausprägung als Knopf („NW 7,6“, teilweise bewertet „2/4“); öffnet das Popover.
 * @param {{ o: MatrixOption, optLabel: string }} props
 */
export function ScoreButton({ o, optLabel }) {
  const s = Evaluation.optionScore(state, o);
  const value = s.value == null ? null : Util.formatNumber(s.value);
  return (
    <button
      type="button" class={`score-btn${scoreFor.value === o.id ? ' is-open' : ''}`} data-score-btn={o.id} aria-haspopup="dialog"
      aria-label={Texts.criteria.buttonLabel(optLabel, value ?? Texts.criteria.unrated)}
      onClick={e => (scoreFor.value === o.id ? closeScorePop() : openScorePop(o.id, /** @type {HTMLElement} */ (e.currentTarget)))}
    >
      <span class="metric-unit">{Texts.matrix.utilityUnit}</span>
      {value == null ? <span class="score-empty">{Texts.criteria.rate}</span> : <b>{value}</b>}
      {value != null && !s.complete ? <span class="score-partial" title={Texts.criteria.partialTitle(s.rated, s.total)}>{`${s.rated}/${s.total}`}</span> : null}
      <svg class="score-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

/** @param {string} oid @param {HTMLElement} anchor */
function openScorePop(oid, anchor) {
  scoreFor.value = oid;
  const pop = $('#scorePop');
  pop.hidden = false;
  placeNear(pop, anchor, { gap: 6 });
  focusField(/** @type {HTMLInputElement | null} */ (pop.querySelector('input')));
}

/** Zur vorigen/nächsten Ausprägung wechseln (Popover bleibt offen). @param {string} oid */
function moveScorePop(oid) {
  const btn = /** @type {HTMLElement | null} */ (document.querySelector(`[data-score-btn="${CSS.escape(oid)}"]`));
  if (btn) {
    keepOpenUntil = performance.now() + 300;
    btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    openScorePop(oid, btn);
  } else {
    // Ausprägung in einer eingeklappten Kategorie: Popover bleibt, wo es ist
    scoreFor.value = oid;
    focusField(/** @type {HTMLInputElement | null} */ ($('#scorePop').querySelector('input')));
  }
}

function closeScorePop(refocus = true) {
  const oid = scoreFor.value;
  if (oid == null) return;
  scoreFor.value = null;
  $('#scorePop').hidden = true;
  if (refocus) /** @type {HTMLElement | null} */ (document.querySelector(`[data-score-btn="${CSS.escape(oid)}"]`))?.focus();
}

function ScorePop() {
  const m = useMatrix();
  const oid = scoreFor.value;
  const ref = oid ? Model.findOption(m, oid) : null;
  if (!oid || !ref || prefs.mode !== 'edit' || !multiCriteria(m)) {
    if (oid != null) queueMicrotask(() => closeScorePop(false)); // gelöscht, Modus oder Einstellung gewechselt
    return null;
  }
  const { p, pi, o, oi } = ref;
  const label = o.text.trim() || Texts.fallback.emptyOption(oi + 1);
  const max = m.settings.utilityMax;
  const s = Evaluation.optionScore(m, o);
  const all = m.parameters.flatMap(x => x.options);
  const idx = all.indexOf(o);
  const shares = Evaluation.criterionShares(m);
  /** Enter springt zum nächsten Kriterium, nach dem letzten zur nächsten Ausprägung. @param {KeyboardEvent} e */
  const onKey = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const i = Number(/** @type {HTMLElement} */ (e.currentTarget).dataset.scoreField);
    const nextField = /** @type {HTMLInputElement | null} */ ($('#scorePop').querySelector(`[data-score-field="${i + 1}"]`));
    if (nextField) focusField(nextField);
    else if (all[idx + 1]) moveScorePop(all[idx + 1].id);
  };
  return (
    <>
      <div class="score-pop-head">
        <div>
          <h3 id="scorePopTitle">{Texts.criteria.popTitle(label)}</h3>
          <p>{Texts.criteria.popHint(Model.parameterLabel(p, pi), max)}</p>
        </div>
        <IconButton icon="x" label={Texts.ui.close} onClick={() => closeScorePop()} />
      </div>
      <div class="score-rows">
        {shares.map(({ c, share }, i) => (
          <label key={c.id} class="score-row">
            <span>{Model.criterionLabel(c)}</span>
            <small>{Util.formatPercent(share)}</small>
            <NumberField
              key={`${o.id}:${c.id}`} value={o.scores[c.id] ?? null} placeholder={`0–${max}`}
              label={Texts.criteria.scoreLabel(Model.criterionLabel(c), label, max)}
              apply={n => setScore(o, c.id, n)} validate={n => n >= 0 && n <= max} data-score-field={i} onKeyDown={onKey}
            />
          </label>
        ))}
      </div>
      <div class="score-total"><span>{Texts.criteria.total}</span><b>{s.value == null ? '–' : Util.formatNumber(s.value)}</b></div>
      <div class="score-foot">
        <span class="score-nav">
          <IconButton icon="left" label={Texts.criteria.prev} disabled={idx <= 0} onClick={() => moveScorePop(all[idx - 1].id)} />
          <IconButton icon="right" label={Texts.criteria.next} disabled={idx >= all.length - 1} onClick={() => moveScorePop(all[idx + 1].id)} />
        </span>
        <button type="button" class="btn btn-small" onClick={() => { closeScorePop(false); openScoreTable(); }}>{Texts.criteria.table}</button>
      </div>
    </>
  );
}

// ---------- Bewertungstabelle ----------

export function openScoreTable() {
  tableOpen.value = true;
  openDialog($('#scoreDialog'));
  focusField(/** @type {HTMLInputElement | null} */ ($('#scoreDialog').querySelector('input[data-r="0"]')));
}

/** Enter bzw. ↓/↑ springen in derselben Spalte zur nächsten bzw. vorigen Zeile. @param {KeyboardEvent} e */
function tableKey(e) {
  const el = /** @type {HTMLInputElement} */ (e.currentTarget);
  let delta = 0;
  if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) delta = 1;
  else if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) delta = -1;
  if (!delta) return;
  e.preventDefault();
  const next = /** @type {HTMLInputElement | null} */ ($('#scoreDialog').querySelector(`input[data-r="${Number(el.dataset.r) + delta}"][data-c="${el.dataset.c}"]`));
  focusField(next);
}

function ScoreTable() {
  const m = useMatrix();
  if (!tableOpen.value) return null;
  const shares = Evaluation.criterionShares(m);
  const max = m.settings.utilityMax;
  let row = 0;
  return (
    <>
      <p class="dialog-hint">{Texts.criteria.tableHint(max)}</p>
      <div class="score-table-wrap">
        <table class="score-table">
          <thead>
            <tr>
              <th scope="col">{Texts.criteria.option}</th>
              {shares.map(({ c, share }) => <th key={c.id} scope="col">{Model.criterionLabel(c)}<small>{Util.formatPercent(share)}</small></th>)}
              <th scope="col" class="num">{Texts.summary.utility}<small>{Texts.criteria.weighted}</small></th>
            </tr>
          </thead>
          <tbody>
            {m.parameters.map((p, pi) => (
              <Fragment key={p.id}>
                <tr class="score-param">
                  <th scope="colgroup" colSpan={shares.length + 2}>
                    {Model.parameterLabel(p, pi)}<small>{Texts.criteria.paramWeight(Util.formatNumber(Evaluation.weightOf(p)))}</small>
                  </th>
                </tr>
                {p.options.map((o, oi) => {
                  const r = row++;
                  const label = o.text.trim() || Texts.fallback.emptyOption(oi + 1);
                  const s = Evaluation.optionScore(m, o);
                  return (
                    <tr key={o.id}>
                      <th scope="row">{label}</th>
                      {shares.map(({ c }, ci) => (
                        <td key={c.id} class="score-cell">
                          <NumberField
                            value={o.scores[c.id] ?? null} placeholder="–" label={Texts.criteria.scoreLabel(Model.criterionLabel(c), label, max)}
                            apply={n => setScore(o, c.id, n)} validate={n => n >= 0 && n <= max} data-r={r} data-c={ci} onKeyDown={tableKey}
                          />
                        </td>
                      ))}
                      <td class="num">{s.value == null ? '–' : Util.formatNumber(s.value)}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function initCriteria() {
  mount(<ScorePop />, $('#scorePop'));
  mount(<ScoreTable />, $('#scoreBody'));
  const dialog = $('#scoreDialog');
  dialog.addEventListener('close', () => { tableOpen.value = false; });
  $('#scoreClose').addEventListener('click', () => closeDialog(dialog));
  $('#scoreDone').addEventListener('click', () => closeDialog(dialog));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && scoreFor.value != null) { e.preventDefault(); closeScorePop(); }
  });
  document.addEventListener('mousedown', e => {
    if (scoreFor.value == null) return;
    if (!/** @type {HTMLElement} */ (e.target).closest('#scorePop, [data-score-btn]')) closeScorePop(false);
  });
  // Bildlauf (Seite oder Matrix) verschiebt die Zelle: Popover schließen; Bildlauf im Popover nicht
  window.addEventListener('scroll', e => {
    if (scoreFor.value == null || performance.now() < keepOpenUntil) return;
    if (!$('#scorePop').contains(/** @type {Node} */ (e.target))) closeScorePop(false);
  }, { passive: true, capture: true });
}
