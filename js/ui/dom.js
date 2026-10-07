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
 * @param {{ disabled?: boolean, danger?: boolean, small?: boolean }} [opts]
 */
function iconBtn(name, label, onclick, { disabled = false, danger = false, small = true } = {}) {
  return h('button', {
    type: 'button',
    class: `icon-btn${small ? ' small' : ''}${danger ? ' danger' : ''}`,
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
