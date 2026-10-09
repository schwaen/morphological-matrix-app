/*
 * DOM-Helfer der Oberfläche: Elemente erzeugen, Symbole, Dialoge, Hinweise, Downloads.
 * Einstieg der Oberfläche ist js/ui/main.js (eingebunden in index.html, gebündelt von Vite).
 */
import { computePosition, flip, offset, shift as shiftInto } from '@floating-ui/dom';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { ICONS } from './components.jsx';
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

/**
 * Element erzeugen. Attribute: `class`, `value`, `style` (Objekt, auch CSS-Variablen),
 * `dataset`, `on…` (Ereignisse); `null`/`false` werden ausgelassen – ebenso Kinder.
 * @param {string} tag
 * @param {Record<string, any> | null} [attrs]
 * @param {...any} children
 * @returns {any}
 */
export function h(tag, attrs, ...children) {
  const el = /** @type {any} */ (document.createElement(tag));
  for (const [key, val] of Object.entries(attrs || {})) {
    if (val == null || val === false) continue;
    if (key === 'class') el.className = val;
    else if (key === 'value') el.value = val;
    else if (key === 'style') for (const [p, v] of Object.entries(val)) el.style.setProperty(p, v);
    else if (key === 'dataset') Object.assign(el.dataset, val);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), val);
    else el.setAttribute(key, val === true ? '' : val);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** @param {keyof typeof ICONS} name */
export function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/**
 * @param {keyof typeof ICONS} name
 * @param {string} label
 * @param {(e: Event) => void} onclick
 * @param {{ disabled?: boolean, danger?: boolean, small?: boolean, active?: boolean }} [opts]
 */
export function iconBtn(name, label, onclick, { disabled = false, danger = false, small = true, active = false } = {}) {
  return h('button', {
    type: 'button',
    class: `icon-btn${small ? ' small' : ''}${danger ? ' danger' : ''}${active ? ' is-on' : ''}`,
    title: label,
    'aria-label': label,
    disabled,
    onclick,
  }, icon(name));
}

/** Kinder ersetzen; leere Einträge (null/false) werden ausgelassen, statt als „null“ zu erscheinen. */
export function replaceWith(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter(c => c != null && c !== false));
}

/** @param {any} dialog */
export function openDialog(dialog) {
  if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
}

/** @param {any} dialog */
export function closeDialog(dialog) {
  if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
}

/**
 * Merkmal, um ein Bedienelement nach einem Neuaufbau wiederzufinden: `id`, `data-fid`,
 * `data-pair`, Klasse mit `data-cid` oder `aria-label` (in dieser Reihenfolge).
 * @param {Element} el @returns {string | null}
 */
function focusKey(el) {
  const { fid, pair, cid } = /** @type {HTMLElement} */ (el).dataset;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (fid) return `[data-fid="${CSS.escape(fid)}"]`;
  if (pair) return `[data-pair="${CSS.escape(pair)}"]`;
  if (cid && el.classList.length) return `.${CSS.escape(el.classList[0])}[data-cid="${CSS.escape(cid)}"]`;
  const label = el.getAttribute('aria-label');
  return label ? `[aria-label="${CSS.escape(label)}"]` : null;
}

/**
 * Inhalt eines Behälters ersetzen und dabei erhalten, was der Neuaufbau sonst verlöre: den Fokus
 * (samt Textauswahl in Eingabefeldern) und die Bildlaufpositionen der Elemente mit `data-scroll`.
 * @param {HTMLElement} container @param {...any} children wie bei `replaceWith`
 */
export function rebuild(container, ...children) {
  const active = /** @type {any} */ (document.activeElement);
  const inside = active && active !== container && container.contains(active) ? active : null;
  const key = inside ? focusKey(inside) : null;
  const selection = inside && typeof inside.selectionStart === 'number' ? [inside.selectionStart, inside.selectionEnd] : null;
  const scrolls = $$('[data-scroll]', container).map(el => [el.dataset.scroll, el.scrollTop, el.scrollLeft]);
  replaceWith(container, ...children);
  for (const [name, top, left] of scrolls) {
    const el = $(`[data-scroll="${CSS.escape(String(name))}"]`, container);
    if (el) { el.scrollTop = top; el.scrollLeft = left; }
  }
  const target = key ? $(key, container) : null;
  if (target) {
    target.focus({ preventScroll: true });
    if (selection && typeof target.setSelectionRange === 'function') {
      try { target.setSelectionRange(selection[0], selection[1]); } catch (e) { /* nicht unterstützt */ }
    }
  }
}

/**
 * Schwebendes Element neben seinem Auslöser platzieren, vollständig im sichtbaren Bereich
 * (Floating UI: bei Platzmangel auf die andere Seite klappen, am Rand verschieben).
 * `below`: unter dem Auslöser, waagerecht um `shift` versetzt; `right`: rechts daneben,
 * senkrecht um `shift` versetzt. Gilt für `position: fixed` und `position: absolute` gleichermaßen.
 * @param {HTMLElement} el @param {Element} anchor Auslöser
 * @param {{ side?: 'below' | 'right', gap?: number, shift?: number, margin?: number }} [opts]
 * @returns {Promise<void>}
 */
export async function placeNear(el, anchor, { side = 'below', gap = 6, shift = 0, margin = 8 } = {}) {
  const { x, y } = await computePosition(anchor, el, {
    placement: side === 'below' ? 'bottom-start' : 'right-start',
    strategy: getComputedStyle(el).position === 'fixed' ? 'fixed' : 'absolute',
    middleware: [offset({ mainAxis: gap, crossAxis: shift }), flip({ padding: margin }), shiftInto({ padding: margin })],
  });
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

let toastTimer = 0;
/** Kurzer Hinweis unten; optional mit „Rückgängig“. */
export function toast(message, withUndo = false) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  // Ein offener Dialog liegt in der obersten Ebene über allem anderen – die Meldung muss
  // dann in den Dialog, sonst läge sie hinter dessen abgedunkeltem Hintergrund.
  const host = $('dialog[open]') || document.body;
  if (el.parentElement !== host) host.append(el);
  el.replaceChildren(h('span', null, message));
  if (withUndo) {
    el.append(h('button', { type: 'button', onclick: () => { undo(); el.hidden = true; } }, Texts.toast.undo));
  }
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, withUndo ? 6000 : 3500);
}

/** @param {string} filename @param {string} content @param {string} type */
/** @param {string} filename @param {BlobPart} content @param {string} type */
export function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
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
