/*
 * Status je Konzept (Entwurf, Favorit, verworfen, gewählt): Chip in der Konzeptliste und im
 * Vergleich sowie das Menü zum Ändern samt Grund.
 */
import { signal } from '@preact/signals';
import { render as mount } from 'preact';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { setConceptStatus } from './actions.js';
import { fieldProps, state, useMatrix } from './core.js';
import { $, placeNear } from './dom.jsx';

/** Konzept, dessen Status-Menü offen ist. */
const statusFor = signal(/** @type {string | null} */ (null));

/** Symbol und Bezeichnung eines Status. @param {ConceptStatus} status */
export const statusLabel = status => {
  const { icon, label } = Texts.status.levels[status];
  return icon ? `${icon} ${label}` : label;
};

/**
 * Status-Chip; `compact` zeigt nur das Symbol (Kopf des Vergleichs, ohne Entwurf).
 * @param {{ c: MatrixConcept, compact?: boolean }} props
 */
export function StatusChip({ c, compact = false }) {
  const { icon, label } = Texts.status.levels[c.status];
  if (compact) {
    return c.status === 'draft' ? null : <span class={`status-chip status-${c.status}`} title={label}>{icon}</span>;
  }
  return (
    <button
      type="button" class={`status-chip status-${c.status}`} data-status-btn={c.id} aria-haspopup="dialog"
      aria-label={Texts.status.button(Model.nameOrUnnamed(c), label)}
      onClick={e => openStatusPop(c.id, /** @type {HTMLElement} */ (e.currentTarget))}
    >{statusLabel(c.status)}</button>
  );
}

/** @param {string} cid @param {HTMLElement} anchor */
function openStatusPop(cid, anchor) {
  if (statusFor.value === cid) { closeStatusPop(); return; }
  statusFor.value = cid;
  const pop = $('#statusPop');
  pop.hidden = false;
  placeNear(pop, anchor, { gap: 6 });
  /** @type {HTMLInputElement | null} */ (pop.querySelector('input:checked'))?.focus();
}

function closeStatusPop() {
  const cid = statusFor.value;
  if (cid == null) return;
  statusFor.value = null;
  $('#statusPop').hidden = true;
  // Fokus zurück zum Chip
  /** @type {HTMLElement | null} */ (document.querySelector(`[data-status-btn="${CSS.escape(cid)}"]`))?.focus();
}

function StatusPop() {
  useMatrix();
  const cid = statusFor.value;
  const c = cid ? state.concepts.find(x => x.id === cid) : null;
  if (!c) {
    if (cid != null) queueMicrotask(closeStatusPop); // Konzept gelöscht
    return null;
  }
  const name = Model.nameOrUnnamed(c);
  return (
    <>
      <h3 id="statusPopTitle">{Texts.status.popTitle(name)}</h3>
      <div class="status-options" role="radiogroup" aria-labelledby="statusPopTitle">
        {Model.CONCEPT_STATUSES.map(s => (
          <label key={s} class={`status-option${c.status === s ? ' is-on' : ''}`}>
            <input type="radio" name="conceptStatus" value={s} checked={c.status === s} onChange={() => setConceptStatus(c.id, s)} />
            <span>{statusLabel(s)}</span>
            <small>{Texts.status.levels[s].hint}</small>
          </label>
        ))}
      </div>
      <textarea
        class="status-note autosize" rows={2} value={c.statusNote} placeholder={Texts.status.notePlaceholder}
        aria-label={Texts.status.noteLabel(name)} {...fieldProps(v => { c.statusNote = v; })}
      />
    </>
  );
}

export function initStatus() {
  mount(<StatusPop />, $('#statusPop'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && statusFor.value != null) { e.preventDefault(); closeStatusPop(); }
  });
  document.addEventListener('mousedown', e => {
    if (statusFor.value == null) return;
    if (!/** @type {HTMLElement} */ (e.target).closest('#statusPop, [data-status-btn]')) closeStatusPop();
  });
  window.addEventListener('scroll', e => {
    // Bildlauf innerhalb des Menüs (Textfeld) schließt es nicht
    if (statusFor.value != null && !$('#statusPop').contains(/** @type {Node} */ (e.target))) closeStatusPop();
  }, { passive: true, capture: true });
}
