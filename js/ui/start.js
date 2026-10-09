/*
 * Start-Menü am Logo (Einstiege, zuletzt geöffnete Matrizen, Hilfe) und der Dialog
 * „Hilfe & Über“ mit den Reitern Erste Schritte, Tastenkürzel und Über.
 */
import { Model } from '../model.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { docId } from './core.js';
import { MENU_ACTIONS } from './dialogs.js';
import { $, $$, closeDialog, h, openDialog, placeNear, replaceWith } from './dom.js';
import { reopenTab } from './tabs.js';

const RECENT_COUNT = 5;

function toggleStartMenu(open) {
  const menu = $('#startMenu');
  const btn = $('#logoBtn');
  const willOpen = open ?? menu.hidden;
  if (willOpen) {
    renderStartMenu();
    menu.hidden = false;
    placeNear(menu, btn);
  }
  menu.hidden = !willOpen;
  btn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) $('button', menu).focus();
}

/** Symbol für einen Menüeintrag. @param {string} d Pfad im 24er-Raster */
function menuIcon(d) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

const START_ICONS = {
  new: 'M12 5v14M5 12h14',
  example: 'M4 6h16M4 12h16M4 18h10',
  library: 'M3 7h6l2 2h10v10H3z',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5',
  help: 'M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  about: 'M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18M12 11v6M12 7h.01',
};

const recentDate = new Intl.DateTimeFormat(Texts.meta.locale, { dateStyle: 'medium' });

function renderStartMenu() {
  /**
   * @param {string} label @param {keyof typeof START_ICONS} iconName @param {() => void} action
   * @param {any} [extra] Zusatz rechts (z. B. Datum)
   */
  const item = (label, iconName, action, extra = null) => h('button', {
    type: 'button', role: 'menuitem',
    onclick: () => { toggleStartMenu(false); action(); },
  }, menuIcon(START_ICONS[iconName]), h('span', { class: 'start-label' }, label), extra);
  // Zuletzt gespeicherte Matrizen (ohne die gerade angezeigte)
  const recent = Store.listDocs().filter(doc => doc.id !== docId).slice(0, RECENT_COUNT);
  replaceWith($('#startMenu'),
    h('div', { class: 'start-head', role: 'presentation' },
      $('#logoBtn .logo').cloneNode(true),
      h('div', null, h('strong', null, Texts.ui.appName), h('small', null, Texts.start.localHint))),
    item(Texts.tabs.newBlank, 'new', MENU_ACTIONS.new),
    item(Texts.tabs.example, 'example', MENU_ACTIONS.example),
    item(Texts.start.library, 'library', MENU_ACTIONS.open),
    recent.length ? [
      h('div', { class: 'menu-label', role: 'presentation' }, Texts.start.recent),
      recent.map(doc => item(doc.data.title || Texts.fallback.unnamedMatrix, 'doc', () => reopenTab(doc.id),
        h('span', { class: 'start-date' }, recentDate.format(doc.savedAt)))),
    ] : null,
    h('hr'),
    item(Texts.start.help, 'help', () => openHelp('start')),
    item(Texts.start.about, 'about', () => openHelp('about')),
  );
}

// ---------- Dialog „Hilfe & Über“ ----------

/** @typedef {'start' | 'keys' | 'about'} HelpTab */

/** @param {HelpTab} [tab] */
function openHelp(tab = 'start') {
  renderHelp();
  showHelpTab(tab);
  openDialog($('#helpDialog'));
  $(`[data-help-tab="${tab}"]`).focus();
}

/** @param {HelpTab} tab */
function showHelpTab(tab) {
  for (const btn of $$('[data-help-tab]')) {
    const on = btn.dataset.helpTab === tab;
    btn.setAttribute('aria-selected', String(on));
    btn.setAttribute('tabindex', on ? '0' : '-1');
    $(`#${btn.getAttribute('aria-controls')}`).hidden = !on;
  }
}

function renderHelp() {
  const H = Texts.help;
  if (!$('#helpLogo').firstChild) $('#helpLogo').append($('#logoBtn .logo').cloneNode(true));
  replaceWith($('#helpStart'),
    h('ol', { class: 'help-steps' }, H.steps.map(([title, text]) => h('li', null, h('strong', null, title), h('span', null, text)))),
    h('p', { class: 'help-more' }, H.more));
  replaceWith($('#helpKeys'),
    H.keyGroups.map(([group, rows]) => [
      h('h3', null, group),
      h('table', { class: 'help-keys' }, h('tbody', null, rows.map(([what, keys]) => h('tr', null,
        h('td', null, what),
        h('td', null, keys.map((k, i) => [i ? h('span', { class: 'help-or' }, ` ${H.or} `) : null, h('kbd', null, k)]))))))]));
  replaceWith($('#helpAbout'), H.about.map(text => h('p', null, text)));
  $('#helpMeta').textContent = H.meta(Model.SCHEMA_VERSION);
}

export function initStart() {
  const menu = $('#startMenu');
  $('#logoBtn').addEventListener('click', e => { e.stopPropagation(); toggleStartMenu(); });
  menu.addEventListener('keydown', e => {
    const items = $$('button', menu);
    const i = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  document.addEventListener('click', e => {
    if (!menu.hidden && !/** @type {HTMLElement} */ (e.target).closest('#startMenu, #logoBtn')) toggleStartMenu(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) {
      toggleStartMenu(false);
      $('#logoBtn').focus();
    }
  });

  // Dialog: Reiter per Klick und Pfeiltasten
  const tabs = $$('[data-help-tab]');
  for (const btn of tabs) {
    btn.addEventListener('click', () => showHelpTab(/** @type {HelpTab} */ (btn.dataset.helpTab)));
    btn.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(tabs.indexOf(btn) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      showHelpTab(/** @type {HelpTab} */ (next.dataset.helpTab));
      next.focus();
    });
  }
  const dlg = $('#helpDialog');
  $('#helpClose').addEventListener('click', () => closeDialog(dlg));
  $('#helpDone').addEventListener('click', () => closeDialog(dlg));
  dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(dlg); });
}
