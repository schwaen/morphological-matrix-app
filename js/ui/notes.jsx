/*
 * Notizen: Eingabefelder für Notizen an Ausprägungen und Beschreibungen an Parametern
 * (Bearbeiten-Modus) und das Popover, das sie im Modus „Kombinieren“ beim Überfahren zeigt –
 * zusammen mit Hinweisen zur Verträglichkeit.
 * Die Begründung je Konzept steht in der Zusammenfassung (render-panels.jsx).
 */
import { signal } from '@preact/signals';
import { render as mount } from 'preact';
import { Icon, IconButton } from './components.jsx';
import { fieldProps, prefs, setPendingFocus } from './core.js';
import { $, placeNear } from './dom.jsx';
import { applyPendingFocus, render } from './render-panels.jsx';

/** IDs (Ausprägung oder Parameter), deren leeres Notizfeld gerade geöffnet ist. */
const openNotes = signal(/** @type {ReadonlySet<string>} */ (new Set()));

/** @param {string} id @param {boolean} open */
function setNoteOpen(id, open) {
  const next = new Set(openNotes.value);
  if (open) next.add(id); else next.delete(id);
  openNotes.value = next;
}

/**
 * Notizfeld eines Elements; ist es beim Verlassen leer, verschwindet es wieder.
 * @param {{ target: { note: string }, id: string, cls: string, placeholder: string, label: string }} props
 *   `target`: Ausprägung oder Parameter
 */
export function NoteField({ target, id, cls, placeholder, label }) {
  return (
    <textarea
      class={`note-field ${cls} autosize`} rows={1} value={target.note} placeholder={placeholder}
      aria-label={label} data-fid={`note:${id}`}
      {...fieldProps(v => { target.note = v; })}
      // Offen gehalten wird nur bis zum Verlassen; danach entscheidet allein, ob es eine Notiz gibt
      onBlur={() => setNoteOpen(id, false)}
    />
  );
}

/**
 * Knopf zum Öffnen der Notiz; zeigt an, ob es schon eine gibt.
 * @param {{ target: { note: string }, id: string, labels: [string, string] }} props `labels`: hinzufügen, bearbeiten
 */
export function NoteButton({ target, id, labels }) {
  return <IconButton icon="note" label={target.note ? labels[1] : labels[0]} active={!!target.note} onClick={() => openNote(id)} data-note-btn={id} />;
}

/** Notizfeld öffnen (bzw. das vorhandene fokussieren). @param {string} id */
function openNote(id) {
  setNoteOpen(id, true);
  setPendingFocus(`note:${id}`);
  render();
  applyPendingFocus();
}

/** Ob das Notizfeld angezeigt wird. @param {{ note: string }} target @param {string} id */
export const showNote = (target, id) => !!target.note || openNotes.value.has(id);

/** Kleines Notiz-Symbol (den Text erhalten Screenreader über `aria-description` der Zelle). */
export const NoteMark = () => <span class="note-ico" aria-hidden="true"><Icon name="note" /></span>;

// ---------- Popover beim Überfahren ----------

/**
 * Zeigt unter dem Element den Hinweis zur Verträglichkeit (`data-cons`, `data-cons-label`,
 * `data-cons-type`) und die Notiz (`data-note`, `data-note-label`).
 * @param {HTMLElement} el
 */
function showNotePop(el) {
  const pop = $('#notePop');
  const d = el.dataset;
  mount(
    <>
      {d.cons ? <div class={`pop-cons ${d.consType}`}><strong>{d.consLabel}</strong>{d.cons}</div> : null}
      {d.note ? <div><strong>{d.noteLabel}</strong>{d.note}</div> : null}
    </>,
    pop,
  );
  pop.hidden = false;
  placeNear(pop, el, { shift: 12, margin: 4 });
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
