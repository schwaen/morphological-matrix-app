/*
 * Helfer für das statische Gerüst in index.html: Elemente finden, Dialoge, schwebende Elemente,
 * Hinweise, Downloads, Textfeldhöhe, statische Texte und Konzeptfarben.
 * Einstieg der Oberfläche ist js/ui/main.js (eingebunden in index.html, gebündelt von Vite).
 */
import { render as mount } from 'preact';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { undo } from './core.js';


/**
 * Erstes passendes Element (bewusst lose typisiert: Formularfelder, Dialoge, …).
 * @type {(sel: string, root?: ParentNode) => any}
 */
export const $ = (sel, root = document) => root.querySelector(sel);

/**
 * Alle passenden Elemente als Array.
 * @type {(sel: string, root?: ParentNode) => HTMLElement[]}
 */
export const $$ = (sel, root = document) => [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(sel))];

/** @param {any} dialog */
export function openDialog(dialog) {
  if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
}

/** @param {any} dialog */
export function closeDialog(dialog) {
  if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
}

/**
 * Schwebendes Element neben seinem Auslöser platzieren, vollständig im sichtbaren Bereich.
 * `below`: unter dem Auslöser (passt es nicht, darüber), waagerecht um `shift` versetzt;
 * `right`: rechts daneben (passt es nicht, links), senkrecht um `shift` versetzt.
 * Bei `position: absolute` (im Dokument) kommt die Bildlaufposition hinzu, bei `fixed` nicht.
 * Das Element muss sichtbar sein (Größe messbar).
 * @param {HTMLElement} el @param {Element} anchor Auslöser
 * @param {{ side?: 'below' | 'right', gap?: number, shift?: number, margin?: number }} [opts]
 */
export function placeNear(el, anchor, { side = 'below', gap = 6, shift = 0, margin = 8 } = {}) {
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth;
  const ht = el.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (/** @type {number} */ v, /** @type {number} */ size, /** @type {number} */ max) => Math.max(margin, Math.min(v, max - size - margin));
  let left;
  let top;
  if (side === 'below') {
    left = clamp(r.left + shift, w, vw);
    top = r.bottom + gap + ht <= vh - margin ? r.bottom + gap : Math.max(margin, r.top - ht - gap);
  } else {
    left = r.right + gap + w <= vw - margin ? r.right + gap : Math.max(margin, r.left - w - gap);
    top = clamp(r.top + shift, ht, vh);
  }
  const page = getComputedStyle(el).position !== 'fixed';
  el.style.left = `${left + (page ? window.scrollX : 0)}px`;
  el.style.top = `${top + (page ? window.scrollY : 0)}px`;
}

let toastTimer = 0;
/** Kurzer Hinweis unten; optional mit „Rückgängig“. @param {string} message @param {boolean} [withUndo] */
export function toast(message, withUndo = false) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  // Ein offener Dialog liegt in der obersten Ebene über allem anderen – die Meldung muss
  // dann in den Dialog, sonst läge sie hinter dessen abgedunkeltem Hintergrund.
  const host = $('dialog[open]') || document.body;
  if (el.parentElement !== host) host.append(el);
  mount(
    <>
      <span>{message}</span>
      {withUndo ? <button type="button" onClick={() => { undo(); el.hidden = true; }}>{Texts.toast.undo}</button> : null}
    </>,
    el,
  );
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, withUndo ? 6000 : 3500);
}

/** @param {string} filename @param {BlobPart} content @param {string} type */
export function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Feld mit `data-fid` fokussieren und Cursor ans Ende setzen. @param {string} fid */
export function focusField(fid) {
  const el = /** @type {HTMLInputElement | HTMLTextAreaElement | null} */ (document.querySelector(`[data-fid="${CSS.escape(fid)}"]`));
  if (!el) return;
  el.focus();
  const len = el.value.length;
  try { el.setSelectionRange(len, len); } catch (e) { /* nicht unterstützt */ }
}

const supportsFieldSizing = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content');

/** Textfeldhöhe an den Inhalt anpassen (nur nötig ohne CSS `field-sizing`). */
export function autosize(el) {
  if (supportsFieldSizing) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

export function autosizeAll() {
  if (supportsFieldSizing) return;
  $$('textarea.autosize, #description').forEach(autosize);
}

// ---------- Statische Texte (index.html) ----------

/** Text zu einem Schlüssel wie „ui.menu.file“ aus der aktiven Sprache. @param {string} key */
function textFor(key) {
  /** @type {any} */
  const value = key.split('.').reduce((/** @type {any} */ o, k) => (o == null ? o : o[k]), Texts);
  if (typeof value !== 'string') {
    console.warn(`Text „${key}“ fehlt in der Sprache ${Texts.meta.lang}.`);
    return key;
  }
  return value;
}

/**
 * Statische Texte der Seite aus der aktiven Sprache setzen:
 * `data-i18n` (Textinhalt), `data-i18n-html` (Inhalt mit Formatierung, nur eigene Texte) und
 * `data-i18n-attr="attribut:schlüssel;…"` (z. B. title, aria-label, placeholder).
 */
export function applyStaticTexts() {
  document.documentElement.lang = Texts.meta.lang;
  // Beschriftung „bester Wert“ im Konzeptvergleich (CSS ::after)
  document.documentElement.style.setProperty('--best-label', JSON.stringify(Texts.compare.best));
  $$('[data-i18n]').forEach(el => { el.textContent = textFor(/** @type {string} */ (el.dataset.i18n)); });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = textFor(/** @type {string} */ (el.dataset.i18nHtml)); });
  $$('[data-i18n-attr]').forEach(el => {
    for (const pair of /** @type {string} */ (el.dataset.i18nAttr).split(';')) {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr.trim(), textFor(key.trim()));
    }
  });
  $$('[data-lang]').forEach(el => el.setAttribute('aria-checked', String(el.dataset.lang === Texts.meta.lang)));
}

// ---------- Konzeptfarben im hellen/dunklen Farbschema ----------

export const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Anzeigefarbe eines Konzepts: Im Dunkelmodus erscheinen die Farben der Standardreihe in ihrer
 * Dunkelstufe (Model.COLORS_DARK); selbst gewählte Farben bleiben unverändert.
 * @param {string} color gespeicherte Farbe
 */
export function shownColor(color) {
  return darkScheme.matches ? (Model.COLORS_DARK[color.toLowerCase()] || color) : color;
}
