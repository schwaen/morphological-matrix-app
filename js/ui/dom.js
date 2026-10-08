/*
 * DOM-Helfer der Oberfläche: Elemente erzeugen, Symbole, Dialoge, Hinweise, Downloads.
 * Die UI-Dateien unter js/ui/ sind klassische Skripte und teilen sich ihre Funktionen
 * über den globalen Gültigkeitsbereich (Reihenfolge siehe index.html).
 */
'use strict';

const ICONS = {
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5M8.5 9h7M8.5 12.5h4',
  ban: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M5.6 5.6l12.8 12.8',
};

/**
 * Erstes passendes Element (bewusst lose typisiert: Formularfelder, Dialoge, …).
 * @type {(sel: string, root?: ParentNode) => any}
 */
const $ = (sel, root = document) => root.querySelector(sel);

/**
 * Alle passenden Elemente als Array.
 * @type {(sel: string, root?: ParentNode) => HTMLElement[]}
 */
const $$ = (sel, root = document) => [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(sel))];

/**
 * Element erzeugen. Attribute: `class`, `value`, `style` (Objekt, auch CSS-Variablen),
 * `dataset`, `on…` (Ereignisse); `null`/`false` werden ausgelassen – ebenso Kinder.
 * @param {string} tag
 * @param {Record<string, any> | null} [attrs]
 * @param {...any} children
 * @returns {any}
 */
function h(tag, attrs, ...children) {
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
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** @param {keyof typeof ICONS} name */
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

/**
 * @param {keyof typeof ICONS} name
 * @param {string} label
 * @param {(e: Event) => void} onclick
 * @param {{ disabled?: boolean, danger?: boolean, small?: boolean, active?: boolean }} [opts]
 */
function iconBtn(name, label, onclick, { disabled = false, danger = false, small = true, active = false } = {}) {
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
function replaceWith(el, ...children) {
  el.replaceChildren(...children.flat().filter(c => c != null && c !== false));
}

/** @param {any} dialog */
function openDialog(dialog) {
  if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
}

/** @param {any} dialog */
function closeDialog(dialog) {
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
function rebuild(container, ...children) {
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
 * Schwebendes Element neben seinem Auslöser platzieren, vollständig im sichtbaren Bereich.
 * `below`: unter dem Auslöser (passt es nicht, darüber), waagerecht um `shift` versetzt;
 * `right`: rechts daneben (passt es nicht, links), senkrecht um `shift` versetzt.
 * Für `position: fixed` gelten Fensterkoordinaten, mit `page: true` (für `position: absolute`
 * im Dokument) kommt die Bildlaufposition hinzu. Das Element muss sichtbar sein (Größe messbar).
 * @param {HTMLElement} el @param {DOMRect} r Rechteck des Auslösers
 * @param {{ side?: 'below' | 'right', gap?: number, shift?: number, margin?: number, page?: boolean }} [opts]
 */
function placeNear(el, r, { side = 'below', gap = 6, shift = 0, margin = 8, page = false } = {}) {
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
  el.style.left = `${left + (page ? window.scrollX : 0)}px`;
  el.style.top = `${top + (page ? window.scrollY : 0)}px`;
}

let toastTimer = 0;
/** Kurzer Hinweis unten; optional mit „Rückgängig“. */
function toast(message, withUndo = false) {
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
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Feld mit `data-fid` fokussieren und Cursor ans Ende setzen. @param {string} fid */
function focusField(fid) {
  const el = /** @type {HTMLInputElement | HTMLTextAreaElement | null} */ (document.querySelector(`[data-fid="${CSS.escape(fid)}"]`));
  if (!el) return;
  el.focus();
  const len = el.value.length;
  try { el.setSelectionRange(len, len); } catch (e) { /* nicht unterstützt */ }
}

const supportsFieldSizing = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content');

/** Textfeldhöhe an den Inhalt anpassen (nur nötig ohne CSS `field-sizing`). */
function autosize(el) {
  if (supportsFieldSizing) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

function autosizeAll() {
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
function applyStaticTexts() {
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

const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Anzeigefarbe eines Konzepts: Im Dunkelmodus erscheinen die Farben der Standardreihe in ihrer
 * Dunkelstufe (Model.COLORS_DARK); selbst gewählte Farben bleiben unverändert.
 * @param {string} color gespeicherte Farbe
 */
function shownColor(color) {
  return darkScheme.matches ? (Model.COLORS_DARK[color.toLowerCase()] || color) : color;
}
