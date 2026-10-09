/*
 * Start-Menü am Logo (Einstiege, zuletzt geöffnete Matrizen, Hilfe) und der Dialog
 * „Hilfe & Über“ mit den Reitern Erste Schritte, Tastenkürzel und Über.
 */
import { signal } from '@preact/signals';
import { Fragment, render as mount } from 'preact';
import { Model } from '../model.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { Logo } from './components.jsx';
import { docId, useMatrix } from './core.js';
import { MENU_ACTIONS } from './dialogs.jsx';
import { $, $$, closeDialog, openDialog, placeNear } from './dom.jsx';
import { reopenTab } from './tabs.jsx';

const RECENT_COUNT = 5;

/** Start-Menü geöffnet. */
const startOpen = signal(false);

/** @param {boolean} [open] */
function toggleStartMenu(open) {
  const menu = $('#startMenu');
  const btn = $('#logoBtn');
  const willOpen = open ?? menu.hidden;
  startOpen.value = willOpen;
  menu.hidden = !willOpen;
  btn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    placeNear(menu, btn);
    $('button', menu).focus();
  }
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

/**
 * Eintrag des Start-Menüs.
 * @param {{ label: string, icon: keyof typeof START_ICONS, action: () => void, extra?: any }} props `extra`: Zusatz rechts (z. B. Datum)
 */
function StartItem({ label, icon, action, extra = null }) {
  return (
    <button type="button" role="menuitem" onClick={() => { toggleStartMenu(false); action(); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={START_ICONS[icon]} /></svg>
      <span class="start-label">{label}</span>
      {extra}
    </button>
  );
}

function StartMenu() {
  useMatrix();
  if (!startOpen.value) return null;
  // Zuletzt gespeicherte Matrizen (ohne die gerade angezeigte)
  const recent = Store.listDocs().filter(doc => doc.id !== docId).slice(0, RECENT_COUNT);
  return (
    <>
      <div class="start-head" role="presentation">
        <Logo />
        <div><strong>{Texts.ui.appName}</strong><small>{Texts.start.localHint}</small></div>
      </div>
      <StartItem label={Texts.tabs.newBlank} icon="new" action={MENU_ACTIONS.new} />
      <StartItem label={Texts.tabs.example} icon="example" action={MENU_ACTIONS.example} />
      <StartItem label={Texts.start.library} icon="library" action={MENU_ACTIONS.open} />
      {recent.length ? (
        <>
          <div class="menu-label" role="presentation">{Texts.start.recent}</div>
          {recent.map(doc => (
            <StartItem
              key={doc.id} label={doc.data.title || Texts.fallback.unnamedMatrix} icon="doc" action={() => reopenTab(doc.id)}
              extra={<span class="start-date">{recentDate.format(doc.savedAt)}</span>}
            />
          ))}
        </>
      ) : null}
      <hr />
      <StartItem label={Texts.start.help} icon="help" action={() => openHelp('start')} />
      <StartItem label={Texts.start.about} icon="about" action={() => openHelp('about')} />
    </>
  );
}

// ---------- Dialog „Hilfe & Über“ ----------

/** @typedef {'start' | 'keys' | 'about'} HelpTab */

/** @param {HelpTab} [tab] */
function openHelp(tab = 'start') {
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

/** Inhalt der Reiter (Texte aus der Sprachdatei). */
function HelpStart() {
  const H = Texts.help;
  return (
    <>
      <ol class="help-steps">{H.steps.map(([title, text]) => <li key={title}><strong>{title}</strong><span>{text}</span></li>)}</ol>
      <p class="help-more">{H.more}</p>
    </>
  );
}

function HelpKeys() {
  const H = Texts.help;
  return (
    <>
      {H.keyGroups.map(([group, rows]) => (
        <Fragment key={group}>
          <h3>{group}</h3>
          <table class="help-keys">
            <tbody>
              {rows.map(([what, keys]) => (
                <tr key={what}>
                  <td>{what}</td>
                  <td>{keys.map((k, i) => <Fragment key={k}>{i ? <span class="help-or">{` ${H.or} `}</span> : null}<kbd>{k}</kbd></Fragment>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Fragment>
      ))}
    </>
  );
}

export function initStart() {
  mount(<Logo />, $('#logoBtn'));
  mount(<StartMenu />, $('#startMenu'));
  mount(<Logo />, $('#helpLogo'));
  mount(<HelpStart />, $('#helpStart'));
  mount(<HelpKeys />, $('#helpKeys'));
  mount(<>{Texts.help.about.map(text => <p key={text}>{text}</p>)}</>, $('#helpAbout'));
  $('#helpMeta').textContent = Texts.help.meta(Model.SCHEMA_VERSION);
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
