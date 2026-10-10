/*
 * Rahmen der Seite als Komponenten: Moduswahl, Rückgängig/Wiederholen, Knöpfe unter der Matrix,
 * automatische Konzepte, Linienmodus, Konzeptvergleich (Kopf und Rahmen) und die
 * Bewertungseinstellungen. index.html enthält dafür nur die leeren Container.
 */
import { effect } from '@preact/signals';
import { render as mount } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { Evaluation } from '../evaluation.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { addCategory, addParameter, changeScale, changeSetting, generateConcept } from './actions.js';
import { Icon } from './components.jsx';
import { openConsDialog } from './constraints.jsx';
import {
  activeConcept, printing, prefs, redo, redoStack, render, revision, setMode, setPref, state, undo, undoStack, useMatrix,
} from './core.js';
import { $ } from './dom.jsx';
import { CompareChart } from './render-chart.jsx';
import { AttributesEditor } from './attributes.jsx';
import { openSolutions } from './solutions.jsx';
import { CompareScatter } from './render-scatter.jsx';
import { compareContent, CompareTable, CompareTools } from './render-panels.jsx';

/** Bearbeiten / Kombinieren. */
function ModeSwitch() {
  useMatrix();
  return (
    <>
      {/** @type {Array<TabPrefs['mode']>} */ (['edit', 'select']).map(mode => (
        <button key={mode} type="button" data-mode={mode} aria-pressed={prefs.mode === mode} onClick={() => setMode(mode)}>
          {mode === 'edit' ? Texts.ui.modeEdit : Texts.ui.modeSelect}
        </button>
      ))}
    </>
  );
}

function HistoryButtons() {
  useMatrix();
  return (
    <>
      <button type="button" class="icon-btn" id="undoBtn" title={Texts.ui.undoTitle} aria-label={Texts.ui.undo} disabled={!undoStack.length} onClick={undo}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
      </button>
      <button type="button" class="icon-btn" id="redoBtn" title={Texts.ui.redoTitle} aria-label={Texts.ui.redo} disabled={!redoStack.length} onClick={redo}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></svg>
      </button>
    </>
  );
}

/** Knöpfe unter der Matrix (nur beim Bearbeiten) und der Hinweis zum Modus. */
function BelowMatrix() {
  useMatrix();
  const editing = prefs.mode === 'edit';
  const c = activeConcept();
  return (
    <>
      {editing ? (
        <>
          <button type="button" class="btn btn-dashed" id="addParamBtn" onClick={() => addParameter(null)}>
            <Icon name="plus" /><span>{Texts.ui.addParameter}</span>
          </button>
          <button type="button" class="btn btn-dashed" id="addCategoryBtn" title={Texts.ui.addCategoryTitle} onClick={addCategory}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7M18 15v6M15 18h6" /></svg>
            <span>{Texts.ui.addCategory}</span>
          </button>
          <button type="button" class="btn btn-dashed" id="consOpenBtn" title={Texts.ui.constraintsTitle} onClick={openConsDialog}>
            <Icon name="ban" /><span>{Texts.ui.constraintsButton}</span>
          </button>
        </>
      ) : (
        <button type="button" class="btn btn-dashed" id="solutionsBtn" title={Texts.solutions.openTitle} onClick={openSolutions}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg><span>{Texts.solutions.button}</span>
        </button>
      )}
      <p class="hint" id="hint">
        {editing ? Texts.hint.edit : (c ? Texts.hint.select(Model.nameOrUnnamed(c)) : Texts.hint.noConcept)}
        {/* Restzahlen gibt es nur mit unverträglichen Paaren (siehe restCounts) */}
        {!editing && state.constraints.some(x => x.type === 'excluded') ? ` ${Texts.cons.restLegend}` : null}
      </p>
    </>
  );
}

const GENERATOR_GROUPS = {
  main: ['max-utility', 'min-utility', 'min-cost', 'max-cost', 'best-value'],
  moscow: ['moscow-must', 'moscow-should', 'moscow-could'],
};

/** Knöpfe „Konzept automatisch erstellen“ – nur die, die mit den aktiven Bewertungen möglich sind. */
function Generators() {
  useMatrix();
  /** @param {string[]} keys */
  const available = keys => keys.filter(k => Evaluation.GENERATORS[k] && Evaluation.GENERATORS[k].available(state));
  const main = available(GENERATOR_GROUPS.main);
  const moscow = available(GENERATOR_GROUPS.moscow);
  const any = main.length + moscow.length > 0;
  useLayoutEffect(() => { $('#autoConcepts').hidden = !any; });
  /** @param {string} k */
  const button = k => {
    const t = /** @type {Record<string, { text: string, title: string }>} */ (Texts.ui.generators)[k];
    return <button key={k} type="button" class="btn btn-small" data-generate={k} title={t.title} onClick={() => generateConcept(k)}>{t.text}</button>;
  };
  if (!any) return null;
  return (
    <>
      <span class="auto-label">{Texts.ui.autoLabel}</span>
      {main.length ? <div class="auto-buttons">{main.map(button)}</div> : null}
      {moscow.length ? (
        <div class="auto-group" id="autoMoscow">
          <span class="auto-label">{Texts.ui.autoMoscow}</span>
          <div class="auto-buttons auto-buttons-list">{moscow.map(button)}</div>
        </div>
      ) : null}
    </>
  );
}

/** Verbindungslinien: alle, nur das aktive Konzept deutlich, aus. */
function LineMode() {
  useMatrix();
  /** @type {Array<{ value: TabPrefs['lines'], text: string, title?: string }>} */
  const modes = [
    { value: 'all', text: Texts.ui.linesAll, title: Texts.ui.linesAllTitle },
    { value: 'active', text: Texts.ui.linesActive, title: Texts.ui.linesActiveTitle },
    { value: 'off', text: Texts.ui.linesOff },
  ];
  return (
    <>
      {modes.map(m => (
        <button
          key={m.value} type="button" data-lines={m.value} title={m.title} aria-pressed={prefs.lines === m.value}
          onClick={() => { setPref('lines', m.value); render(); }}
        >{m.text}</button>
      ))}
    </>
  );
}

/**
 * Ansichtseinstellung des Vergleichs ändern und neu zeichnen.
 * @template {keyof TabPrefs} K @param {K} key @param {TabPrefs[K]} value
 */
function setCompareView(key, value) {
  setPref(key, value);
  render();
}

/** Konzeptvergleich: Kopf (auf-/zuklappen, Darstellung) und Inhalt; ohne Konzepte oder Parameter ausgeblendet. */
function CompareSection() {
  useMatrix();
  const shown = state.concepts.length > 0 && state.parameters.length > 0;
  useLayoutEffect(() => { $('#compareSection').hidden = !shown; });
  if (!shown) return null;
  // Beim Drucken immer offen und als Tabelle
  const open = printing || prefs.compareOpen !== false;
  // „Kosten/Nutzen“ nur mit Kosten und Nutzwert; sonst (und beim Drucken) die Tabelle
  const scatterOk = state.settings.costs && state.settings.utility;
  /** @type {Array<NonNullable<TabPrefs['compareView']>>} */
  const views = ['table', 'chart', ...(scatterOk ? /** @type {const} */ (['scatter']) : [])];
  const pref = prefs.compareView || 'table';
  const view = printing || !views.includes(pref) ? 'table' : pref;
  const VIEW_TEXT = {
    table: { text: Texts.ui.compareTable, title: undefined },
    chart: { text: Texts.ui.compareChart, title: Texts.ui.compareChartTitle },
    scatter: { text: Texts.ui.compareScatter, title: Texts.ui.compareScatterTitle },
  };
  return (
    <>
      <h2 id="compareHeading" class="collapsible-head">
        <button
          type="button" class="collapse-toggle" id="compareToggle" aria-expanded={open} aria-controls="compareBody"
          onClick={() => setCompareView('compareOpen', prefs.compareOpen === false)}
        >
          <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          <span id="compareTitle">{Texts.ui.compareHeading}</span>
          <span class="collapse-meta" id="compareMeta">{Texts.compare.conceptCount(state.concepts.length)}</span>
        </button>
        <div class="segmented compare-views" role="group" aria-label={Texts.ui.compareViews}>
          {views.map(v => (
            <button
              key={v} type="button" data-compare-view={v} aria-pressed={view === v} title={VIEW_TEXT[v].title}
              onClick={() => { setPref('compareOpen', true); setCompareView('compareView', v); }}
            >{VIEW_TEXT[v].text}</button>
          ))}
        </div>
      </h2>
      <div class="compare-scroll" id="compareBody" hidden={!open}>
        {open ? (
          <>
            <div class="compare-tools" id="compareTools"><CompareTools setView={setCompareView} /></div>
            <table class="compare" id="compareTable" hidden={view !== 'table'}>{view === 'table' ? <CompareTable /> : null}</table>
            <div class="pc" id="compareChart" hidden={view !== 'chart'}>{view === 'chart' ? <CompareChart content={compareContent} /> : null}</div>
            <div class="pc sc" id="compareScatter" hidden={view !== 'scatter'}>{view === 'scatter' ? <CompareScatter content={compareContent} /> : null}</div>
          </>
        ) : null}
      </div>
    </>
  );
}

/** Bewertungseinstellungen (Dialog): Kosten mit Währung, Nutzwert mit Skala, MoSCoW. */
function SettingsForm() {
  useMatrix();
  const s = state.settings;
  /** @param {Event} e */
  const checked = e => /** @type {HTMLInputElement} */ (e.currentTarget).checked;
  /** @param {Event} e */
  const value = e => /** @type {HTMLSelectElement} */ (e.currentTarget).value;
  /** Eigener, formatierter Text aus der Sprachdatei. @param {string} html */
  const rich = html => <span dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <>
      <div class="setting">
        <label class="check setting-toggle">
          <input type="checkbox" id="setCosts" checked={s.costs} onChange={e => changeSetting('costs', checked(e))} />
          {rich(Texts.ui.costsToggle)}
        </label>
        <p class="setting-desc">{Texts.ui.costsDesc}</p>
        <label class="setting-sub">
          <span>{Texts.ui.currency}</span>
          <select id="setCurrency" value={s.currency} disabled={!s.costs} onChange={e => changeSetting('currency', /** @type {any} */ (value(e)))}>
            {Model.CURRENCIES.map(c => <option key={c} value={c}>{Texts.ui.currencies[c]}</option>)}
          </select>
        </label>
      </div>
      <div class="setting">
        <label class="check setting-toggle">
          <input type="checkbox" id="setUtility" checked={s.utility} onChange={e => changeSetting('utility', checked(e))} />
          {rich(Texts.ui.utilityToggle)}
        </label>
        <p class="setting-desc">{Texts.ui.utilityDesc}</p>
        <label class="setting-sub">
          <span>{Texts.ui.scale}</span>
          <select id="setScale" value={String(s.utilityMax)} disabled={!s.utility} onChange={e => changeScale(Number(value(e)))}>
            {Model.SCALES.map(n => <option key={n} value={String(n)}>{Texts.ui.scales[n]}</option>)}
          </select>
        </label>
      </div>
      <div class="setting">
        <label class="check setting-toggle">
          <input type="checkbox" id="setMoscow" checked={s.moscow} onChange={e => changeSetting('moscow', checked(e))} />
          {rich(Texts.ui.moscowToggle)}
        </label>
        <p class="setting-desc" dangerouslySetInnerHTML={{ __html: Texts.ui.moscowDesc }} />
      </div>
      <AttributesEditor />
    </>
  );
}

/** Rahmen einhängen; Titel und Beschreibung folgen der Matrix über einen Effekt. */
export function initChrome() {
  mount(<ModeSwitch />, $('#modeSwitch'));
  mount(<HistoryButtons />, $('#historyButtons'));
  mount(<BelowMatrix />, $('#belowMatrix'));
  mount(<Generators />, $('#autoConcepts'));
  mount(<LineMode />, $('#lineModeButtons'));
  mount(<CompareSection />, $('#compareSection'));
  mount(<SettingsForm />, $('#settingsBody'));
  const desc = $('#description');
  effect(() => {
    revision.value;
    document.title = Texts.app.documentTitle(state.title);
    if (document.activeElement !== desc) desc.value = state.description;
  });
}
