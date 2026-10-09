/*
 * Notizen: Eingabefelder für Notizen an Ausprägungen und Beschreibungen an Parametern
 * (Bearbeiten-Modus) und das Popover, das sie im Modus „Kombinieren“ beim Überfahren zeigt –
 * zusammen mit Hinweisen zur Verträglichkeit.
 * Die Begründung je Konzept steht in der Zusammenfassung (render-panels.js).
 */
import { bindField, prefs, setPendingFocus } from './core.js';
import { $, autosize, h, icon, iconBtn, placeNear, replaceWith } from './dom.js';
import { renderMatrix } from './render-matrix.js';
import { applyPendingFocus, refreshLight } from './render-panels.js';

/** IDs (Ausprägung oder Parameter), deren leeres Notizfeld gerade geöffnet ist. */
const openNotes = new Set();

/**
 * Notizfeld eines Elements; ist es beim Verlassen leer, verschwindet es wieder.
 * @param {{ note: string }} target Ausprägung oder Parameter
 * @param {string} id @param {{ cls: string, placeholder: string, label: string }} opts
 */
export function noteField(target, id, { cls, placeholder, label }) {
  const ta = h('textarea', {
    class: `note-field ${cls} autosize`, rows: 1, value: target.note, placeholder,
    'aria-label': label, dataset: { fid: `note:${id}` },
  });
  bindField(ta, v => { target.note = v; }, () => { autosize(ta); syncNoteButton(id, !!target.note); refreshLight(); });
  // Offen gehalten wird nur bis zum Verlassen; danach entscheidet allein, ob es eine Notiz gibt
  ta.addEventListener('blur', () => {
    openNotes.delete(id);
    if (!ta.value) ta.remove();
  });
  return ta;
}

/**
 * Knopf zum Öffnen der Notiz; zeigt an, ob es schon eine gibt.
 * @param {{ note: string }} target @param {string} id @param {[string, string]} labels hinzufügen, bearbeiten
 */
export function noteButton(target, id, labels) {
  const btn = iconBtn('note', target.note ? labels[1] : labels[0], () => openNote(id), { active: !!target.note });
  btn.dataset.noteBtn = id;
  btn.dataset.labels = JSON.stringify(labels);
  return btn;
}

/** Knopf nach dem Tippen aktualisieren (ohne die Matrix neu zu zeichnen). @param {string} id @param {boolean} has */
function syncNoteButton(id, has) {
  const btn = $(`[data-note-btn="${CSS.escape(id)}"]`);
  if (!btn) return;
  const label = JSON.parse(btn.dataset.labels)[has ? 1 : 0];
  btn.classList.toggle('is-on', has);
  btn.title = label;
  btn.setAttribute('aria-label', label);
}

/** Notizfeld öffnen (bzw. das vorhandene fokussieren). @param {string} id */
function openNote(id) {
  openNotes.add(id);
  setPendingFocus(`note:${id}`);
  renderMatrix();
  applyPendingFocus();
}

/** Ob das Notizfeld angezeigt wird. @param {{ note: string }} target @param {string} id */
export const showNote = (target, id) => !!target.note || openNotes.has(id);

/** Kleines Notiz-Symbol (den Text erhalten Screenreader über `aria-description` der Zelle). */
export const noteMark = () => h('span', { class: 'note-ico', 'aria-hidden': 'true' }, icon('note'));

// ---------- Popover beim Überfahren ----------

/**
 * Zeigt unter dem Element den Hinweis zur Verträglichkeit (`data-cons`, `data-cons-label`,
 * `data-cons-type`) und die Notiz (`data-note`, `data-note-label`).
 * @param {HTMLElement} el
 */
function showNotePop(el) {
  const pop = $('#notePop');
  const d = el.dataset;
  replaceWith(pop,
    d.cons ? h('div', { class: `pop-cons ${d.consType}` }, h('strong', null, d.consLabel), d.cons) : null,
    d.note ? h('div', null, h('strong', null, d.noteLabel), d.note) : null);
  pop.hidden = false;
  placeNear(pop, el.getBoundingClientRect(), { shift: 12, margin: 4 });
}

function hideNotePop() {
  $('#notePop').hidden = true;
}

export function initNotePop() {
  const matrix = $('#matrix');
  /** @param {Event} e */
  const target = e => /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-note], [data-cons]'));
  const show = e => { const el = target(e); if (el && prefs.mode === 'select') showNotePop(el); };
  const hide = e => { const el = target(e); if (el && !el.contains(/** @type {Node | null} */ (e.relatedTarget))) hideNotePop(); };
  matrix.addEventListener('mouseover', show);
  matrix.addEventListener('focusin', show);
  matrix.addEventListener('mouseout', hide);
  matrix.addEventListener('focusout', hide);
  window.addEventListener('scroll', hideNotePop, { passive: true, capture: true });
}
