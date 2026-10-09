/*
 * Die Matrix: Parameterzeilen, Ausprägungen (Bearbeiten/Kombinieren), Kategorie-Bänder und die
 * Kategorie-Navigation über der Matrix.
 */
import { Fragment, render as mount } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import { Consistency } from '../consistency.js';
import { Evaluation } from '../evaluation.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import {
  NEW_CATEGORY, addOption, addParameter, deleteCategory, deleteOption, deleteParameter, jumpToCategory,
  moveCategory, moveOption, moveParameter, setAllCollapsed, setParameterCategory, setPriority, toggleCategory,
  toggleSelection,
} from './actions.js';
import { Icon, IconButton } from './components.jsx';
import { ConstraintButton, ConstraintCount, conflictText, statusText } from './constraints.jsx';
import { activeConcept, collapseKey, fieldProps, isCollapsed, money, prefs, setPendingFocus, state, useMatrix } from './core.js';
import { $, focusField, shownColor } from './dom.jsx';
import { scheduleLines } from './lines.js';
import { NoteButton, NoteField, NoteMark, showNote } from './notes.jsx';
import { searchClass, searchResult } from './search.js';
import { Util } from '../util.js';

/** @typedef {ReturnType<typeof Model.search> | null} Found */
/**
 * Was alle Zeilen brauchen.
 * @typedef {{ editing: boolean, cols: number, active: MatrixConcept | null, showBands: boolean, found: Found,
 *             status: ReturnType<typeof Consistency.statusFor>, clash: MatrixConstraint[] }} RowContext
 */

/** Die Matrix als Raster (`#matrix`); Spaltenzahl und Modus stehen am Container. */
function Matrix() {
  useMatrix();
  const editing = prefs.mode === 'edit';
  const maxOptions = Math.max(1, ...state.parameters.map(p => p.options.length));
  const cols = maxOptions + (editing ? 1 : 0);
  const found = searchResult();
  useLayoutEffect(() => {
    const matrix = $('#matrix');
    matrix.style.setProperty('--cols', String(cols));
    matrix.classList.toggle('is-editing', editing);
    matrix.classList.toggle('is-selecting', !editing);
    matrix.classList.toggle('is-searching', !!found);
    scheduleLines();
  });
  if (!state.parameters.length) {
    return <div class="matrix-empty">{editing ? Texts.matrix.emptyEdit : Texts.matrix.emptySelect}</div>;
  }
  const active = activeConcept();
  /** @type {RowContext} */
  const ctx = {
    editing, cols, active, showBands: state.categories.length > 0, found,
    // Verträglichkeiten zur Auswahl des aktiven Konzepts (nur im Modus „Kombinieren“)
    status: editing ? new Map() : Consistency.statusFor(state, active),
    clash: editing || !active ? [] : Consistency.conflicts(state, active).excluded,
  };
  return (
    <>
      {Model.categoryGroups(state).map(group => {
        const cid = group.cat ? group.cat.id : null;
        const collapsed = ctx.showBands && isCollapsed(cid);
        return (
          <Fragment key={collapseKey(cid)}>
            {ctx.showBands ? <Band group={group} ctx={ctx} /> : null}
            {collapsed ? null : group.items.map(({ p, pi }) => <ParameterRow key={p.id} p={p} pi={pi} ctx={ctx} />)}
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * Alle Gitterzellen einer Parameterzeile (Kopf, Ausprägungen, Plus-Knopf, Füllzellen).
 * @param {{ p: MatrixParameter, pi: number, ctx: RowContext }} props
 */
function ParameterRow({ p, pi, ctx }) {
  const used = p.options.length + (ctx.editing ? 1 : 0);
  return (
    <>
      {ctx.editing ? <ParameterEdit p={p} pi={pi} ctx={ctx} /> : <ParameterView p={p} pi={pi} ctx={ctx} />}
      {p.options.map((o, oi) => (ctx.editing
        ? <OptionEdit key={o.id} p={p} pi={pi} o={o} oi={oi} ctx={ctx} />
        : <OptionPick key={o.id} p={p} o={o} oi={oi} ctx={ctx} />))}
      {ctx.editing ? (
        <button
          type="button" class="add-opt" title={Texts.matrix.addOption}
          aria-label={Texts.matrix.addOptionTo(Model.parameterLabel(p, pi))} onClick={() => addOption(p.id)}
        ><Icon name="plus" /></button>
      ) : null}
      {Array.from({ length: Math.max(0, ctx.cols - used) }, (_, i) => <div key={`fill${i}`} aria-hidden="true" />)}
    </>
  );
}

/** @param {{ p: MatrixParameter, pi: number, ctx: RowContext }} props */
function ParameterEdit({ p, pi, ctx }) {
  const label = Model.parameterLabel(p, pi);
  return (
    <div class={`param-cell${searchClass(ctx.found, p.id, null)}`} style={categoryStyle(p)} data-pid={p.id}>
      <textarea
        class="param-name autosize" rows={1} value={p.name}
        placeholder={Texts.fallback.parameter(pi + 1)} aria-label={Texts.matrix.parameterName(pi + 1)} data-fid={`param:${p.id}`}
        {...fieldProps(v => { p.name = v; })}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (p.options.length) focusField(`opt:${p.options[0].id}`);
            else addOption(p.id);
          }
        }}
      />
      {showNote(p, p.id)
        ? <NoteField target={p} id={p.id} cls="param-note" placeholder={Texts.notes.paramPlaceholder} label={Texts.notes.paramLabel(label)} />
        : null}
      {ctx.showBands ? <CategorySelect p={p} /> : null}
      <div class="param-foot">
        {state.settings.utility ? (
          <label class="weight-field">
            <span>{Texts.matrix.weight}</span>
            <NumberField
              value={p.weight} placeholder="1" label={Texts.matrix.weightOf(label)}
              apply={n => { p.weight = n != null && n >= 0 ? n : null; }} validate={n => n >= 0}
            />
            <span class="weight-pct" data-weight-pct={p.id}>{weightPercent(p)}</span>
          </label>
        ) : null}
        <div class="row-tools">
          <NoteButton target={p} id={p.id} labels={[Texts.notes.addParam, Texts.notes.editParam]} />
          <IconButton icon="up" label={Texts.matrix.moveUp} onClick={() => moveParameter(pi, -1)} disabled={!Model.canMoveParameter(state, pi, -1)} />
          <IconButton icon="down" label={Texts.matrix.moveDown} onClick={() => moveParameter(pi, 1)} disabled={!Model.canMoveParameter(state, pi, 1)} />
          <IconButton icon="trash" label={Texts.matrix.deleteParameter} onClick={() => deleteParameter(p.id)} danger />
        </div>
      </div>
    </div>
  );
}

/** @param {{ p: MatrixParameter, pi: number, ctx: RowContext }} props */
function ParameterView({ p, pi, ctx }) {
  const label = Model.parameterLabel(p, pi);
  return (
    <div
      class={`param-cell${searchClass(ctx.found, p.id, null)}`} style={categoryStyle(p)} data-pid={p.id}
      data-note={p.note || undefined} data-note-label={p.note ? Texts.notes.paramTitle(label) : undefined}
      aria-description={p.note || undefined}
    >
      <span class="param-label">{label}{p.note ? <NoteMark /> : null}</span>
      <span class="param-meta">
        {Texts.matrix.optionCount(p.options.length) + (state.settings.utility ? ` · ${Texts.matrix.weightShare(weightPercent(p))}` : '')}
      </span>
    </div>
  );
}

/** @param {{ p: MatrixParameter, pi: number, o: MatrixOption, oi: number, ctx: RowContext }} props */
function OptionEdit({ p, pi, o, oi, ctx }) {
  const optLabel = o.text.trim() || Texts.fallback.option(oi + 1);
  const { costs, utility, currency, utilityMax, moscow } = state.settings;
  return (
    <div class={`opt-cell edit${searchClass(ctx.found, p.id, o.id)}`} data-oid={o.id}>
      <div class="opt-main">
        <textarea
          class="autosize" rows={1} value={o.text} placeholder={Texts.fallback.option(oi + 1)}
          aria-label={Texts.matrix.optionField(Model.parameterLabel(p, pi), oi + 1)} data-fid={`opt:${o.id}`}
          {...fieldProps(v => { o.text = v; })}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const next = p.options[oi + 1];
              if (next) focusField(`opt:${next.id}`);
              else if (o.text.trim()) addOption(p.id);
              else {
                const nextParam = state.parameters[pi + 1];
                if (nextParam) focusField(`param:${nextParam.id}`);
              }
            } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
              // Alt+←/→ verschiebt die Ausprägung (Fokus bleibt im Feld)
              e.preventDefault();
              moveOption(p.id, oi, e.key === 'ArrowLeft' ? -1 : 1);
            } else if (e.key === 'Backspace' && !/** @type {HTMLTextAreaElement} */ (e.currentTarget).value && p.options.length > 1) {
              e.preventDefault();
              const prev = p.options[oi - 1] || p.options[oi + 1];
              setPendingFocus(`opt:${prev.id}`);
              deleteOption(p.id, o.id);
            }
          }}
        />
        <ConstraintCount o={o} />
      </div>
      {showNote(o, o.id)
        ? <NoteField target={o} id={o.id} cls="opt-note" placeholder={Texts.notes.placeholder} label={Texts.notes.label(optLabel)} />
        : null}
      <div class="opt-tools">
        <NoteButton target={o} id={o.id} labels={[Texts.notes.add, Texts.notes.edit]} />
        <ConstraintButton o={o} />
        <IconButton icon="left" label={Texts.matrix.moveLeft} onClick={() => moveOption(p.id, oi, -1)} disabled={oi === 0} />
        <IconButton icon="right" label={Texts.matrix.moveRight} onClick={() => moveOption(p.id, oi, 1)} disabled={oi === p.options.length - 1} />
        <IconButton icon="x" label={Texts.matrix.deleteOption} onClick={() => deleteOption(p.id, o.id)} danger />
      </div>
      {costs || utility ? (
        <div class="opt-metrics">
          {costs ? (
            <label class="metric-field">
              <span class="metric-unit">{Util.currencySymbol(currency)}</span>
              <NumberField value={o.cost} placeholder={Texts.matrix.costPlaceholder} label={Texts.matrix.costOf(optLabel)} apply={n => { o.cost = n; }} />
            </label>
          ) : null}
          {utility ? (
            <label class="metric-field">
              <span class="metric-unit" title={Texts.matrix.utilityUnitTitle}>{Texts.matrix.utilityUnit}</span>
              <NumberField
                value={o.score} placeholder={`0–${utilityMax}`} label={Texts.matrix.utilityOf(optLabel, utilityMax)}
                apply={n => { o.score = n; }} validate={n => n >= 0 && n <= utilityMax}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      {moscow ? <PriorityPicker p={p} o={o} optLabel={optLabel} /> : null}
    </div>
  );
}

/** Auswahl M/S/C/W; erneuter Klick auf die gewählte Priorität entfernt sie. @param {{ p: MatrixParameter, o: MatrixOption, optLabel: string }} props */
function PriorityPicker({ p, o, optLabel }) {
  return (
    <div class="opt-prio" role="group" aria-label={Texts.moscow.groupLabel}>
      <span class="metric-unit" aria-hidden="true">{Texts.moscow.short}</span>
      {Model.PRIORITIES.map(level => {
        const { short, label } = Texts.moscow.levels[level];
        return (
          <button
            key={level} type="button" class={`prio-btn prio-${level}`} aria-pressed={o.priority === level}
            title={level === 'wont' ? Texts.moscow.wontHint : label} aria-label={Texts.moscow.setLabel(label, optLabel)}
            onClick={() => setPriority(p.id, o.id, level)}
          >{short}</button>
        );
      })}
    </div>
  );
}

/** Kürzel der Priorität (M/S/C/W). @param {{ o: MatrixOption }} props */
function PriorityBadge({ o }) {
  if (!state.settings.moscow || !o.priority) return null;
  const { short, label } = Texts.moscow.levels[o.priority];
  return <span class={`prio prio-${o.priority}`} title={o.priority === 'wont' ? Texts.moscow.wontHint : label}>{short}</span>;
}

/** Ausprägung im Modus „Kombinieren“. @param {{ p: MatrixParameter, o: MatrixOption, oi: number, ctx: RowContext }} props */
function OptionPick({ p, o, oi, ctx }) {
  const { active, status, clash } = ctx;
  const selectedBy = state.concepts.filter(c => c.selections[p.id] === o.id);
  const isActive = !!active && active.selections[p.id] === o.id;
  // Verträglichkeit: Konflikt der gewählten Ausprägung bzw. Hinweis für nicht gewählte
  const conflict = isActive ? clash.filter(c => c.a === o.id || c.b === o.id) : [];
  const st = isActive ? null : status.get(o.id) || null;
  const cons = conflict.length ? conflictText(o.id, conflict) : (st ? statusText(st) : null);
  const metrics = optionMetricsText(o);
  const text = o.text.trim() || Texts.fallback.emptyOption(oi + 1);
  const cls = `opt-cell pick${isActive ? ' is-active' : ''}${o.text.trim() ? '' : ' is-empty'}`
    + `${state.settings.moscow && o.priority === 'wont' ? ' is-wont' : ''}${conflict.length ? ' is-conflict' : ''}`
    + `${st ? (st.type === 'excluded' ? ' is-blocked' : ' is-conditional') : ''}${searchClass(ctx.found, p.id, o.id)}`;
  return (
    <button
      type="button" class={cls} data-oid={o.id} aria-pressed={isActive}
      title={selectedBy.length ? Texts.matrix.selectedIn(selectedBy.map(Model.nameOrUnnamed).join(', ')) : undefined}
      style={isActive && active ? { '--c': shownColor(active.color) } : undefined}
      data-cell={`${p.id}:${o.id}`}
      data-note={o.note || undefined} data-note-label={o.note ? Texts.notes.title(text) : undefined}
      data-cons={cons ? cons.text : undefined} data-cons-label={cons ? cons.label : undefined} data-cons-type={cons ? cons.type : undefined}
      aria-description={[cons && `${cons.label}: ${cons.text}`, o.note].filter(Boolean).join(' – ') || undefined}
      onClick={() => toggleSelection(p.id, o.id)}
    >
      <span class="opt-label">
        <span>{text}</span>
        {metrics || (state.settings.moscow && o.priority) ? <span class="opt-metrics-view"><PriorityBadge o={o} />{metrics}</span> : null}
      </span>
      {o.note ? <NoteMark /> : null}
      {conflict.length ? <span class="cons-badge" aria-hidden="true">{Texts.cons.conflictBadge}</span> : null}
      {st ? <span class={`cons-ico ${st.type}`} aria-hidden="true">{st.type === 'excluded' ? '✕' : '!'}</span> : null}
      {selectedBy.length ? (
        <span class="markers" aria-hidden="true">
          {selectedBy.map(c => <span key={c.id} class="marker" style={{ '--c': shownColor(c.color) }} />)}
        </span>
      ) : null}
    </button>
  );
}

/** Kosten und Nutzwert einer Ausprägung für die Ansicht „Kombinieren“. @param {MatrixOption} o */
function optionMetricsText(o) {
  const parts = [];
  if (state.settings.costs && o.cost != null) parts.push(money(o.cost));
  if (state.settings.utility && o.score != null) parts.push(Texts.matrix.utilityShort(Util.formatNumber(o.score)));
  return parts.join(' · ');
}

/** Gewichtsanteil eines Parameters als Text („25 %“). @param {MatrixParameter} p */
function weightPercent(p) {
  const share = Evaluation.weightShare(state, p);
  return share == null ? '–' : Util.formatPercent(share);
}

/**
 * Eingabefeld für Zahlen; speichert beim Tippen, formatiert beim Verlassen. Während der Eingabe
 * bleibt der getippte Text stehen (z. B. „1,“), auch wenn er noch keine gültige Zahl ist.
 * @param {{ value: number | null, label: string, placeholder?: string,
 *           apply: (n: number | null) => void, validate?: (n: number) => boolean }} props
 */
function NumberField({ value, label, placeholder, apply, validate }) {
  const [draft, setDraft] = useState(/** @type {string | null} */ (null));
  const text = draft ?? Util.numberToInput(value);
  const n = Util.parseNumber(text);
  const bad = Number.isNaN(n) || (n != null && !!validate && !validate(n));
  const field = fieldProps(v => {
    const parsed = Util.parseNumber(v);
    apply(Number.isNaN(parsed) ? null : parsed);
  });
  return (
    <input
      type="text" inputMode="decimal" class="num-input" value={text}
      placeholder={placeholder} aria-label={label} title={label} aria-invalid={bad || undefined}
      {...field}
      onInput={e => { setDraft(/** @type {HTMLInputElement} */ (e.currentTarget).value); field.onInput(e); }}
      onBlur={() => setDraft(null)}
      onKeyDown={e => { if (e.key === 'Enter') /** @type {HTMLElement} */ (e.currentTarget).blur(); }}
    />
  );
}

// ---------- Kategorien ----------

/** @param {MatrixParameter} p */
function categoryStyle(p) {
  const k = Model.categoryById(state, p.categoryId);
  return k ? { '--k': k.color } : undefined;
}

/** @param {MatrixCategory | null} k */
export const categoryColor = k => (k ? k.color : 'var(--muted)');

/** @param {{ p: MatrixParameter }} props */
function CategorySelect({ p }) {
  return (
    <select
      class="cat-select" aria-label={Texts.category.select(p.name || Texts.compare.parameter)} title={Texts.category.selectTitle}
      value={p.categoryId || ''}
      onChange={e => {
        const select = /** @type {HTMLSelectElement} */ (e.currentTarget);
        setParameterCategory(p.id, select.value);
        select.value = p.categoryId || ''; // z. B. nach Abbruch beim Anlegen einer neuen Kategorie
      }}
    >
      <option value="">{Texts.fallback.noCategory}</option>
      {state.categories.map(k => <option key={k.id} value={k.id}>{Model.nameOrUnnamed(k)}</option>)}
      <option value={NEW_CATEGORY}>{Texts.category.newOption}</option>
    </select>
  );
}

/**
 * Auswahl des aktiven Konzepts innerhalb einer Gruppe (und deren Kosten, falls vollständig).
 * @param {{ items: Array<{ p: MatrixParameter }> }} group @param {MatrixConcept | null} concept
 */
function groupProgress(group, concept) {
  const picks = concept ? group.items.map(({ p }) => Model.selectedOption(p, concept)).filter(o => !!o) : [];
  const cost = state.settings.costs && picks.length && picks.every(o => o.cost != null)
    ? picks.reduce((s, o) => s + (o.cost ?? 0), 0) : null;
  return { picks, cost };
}

/**
 * Kopfzeile einer Kategorie: Ein-/Ausklappen, Name (im Bearbeiten-Modus änderbar), Fortschritt.
 * @param {{ group: { cat: MatrixCategory | null, items: Array<{ p: MatrixParameter, pi: number }> }, ctx: RowContext }} props
 */
function Band({ group, ctx }) {
  const { editing, active, found } = ctx;
  const k = group.cat;
  const cid = k ? k.id : null;
  const collapsed = isCollapsed(cid);
  const n = group.items.length;
  const { picks, cost } = groupProgress(group, active);
  const index = k ? state.categories.indexOf(k) : -1;
  const label = Model.categoryLabel(k);
  return (
    <div class={`cat-band${collapsed ? ' is-collapsed' : ''}${k ? '' : ' is-none'}`} style={{ '--k': categoryColor(k) }} data-cat-band={collapseKey(cid)}>
      <button
        type="button" class="cat-toggle" aria-expanded={!collapsed}
        title={collapsed ? Texts.category.expand : Texts.category.collapse}
        aria-label={Texts.category.toggle(label, collapsed)} onClick={() => toggleCategory(cid)}
      ><span class="cat-chevron" aria-hidden="true" /></button>
      {editing && k ? (
        <>
          <input
            type="color" class="swatch cat-swatch" value={k.color} aria-label={Texts.category.color(k.name)} title={Texts.category.changeColor}
            {...fieldProps(v => { k.color = v; })}
          />
          <input
            type="text" class="cat-name" value={k.name} placeholder={Texts.category.namePlaceholder}
            aria-label={Texts.category.nameLabel} data-fid={`cat:${k.id}`}
            {...fieldProps(v => { k.name = v; })}
            onKeyDown={e => { if (e.key === 'Enter') /** @type {HTMLElement} */ (e.currentTarget).blur(); }}
          />
        </>
      ) : (
        <>
          <span class="cat-dot" aria-hidden="true" />
          <span class="cat-title" onClick={() => toggleCategory(cid)}>{label}</span>
        </>
      )}
      <span class="cat-meta">{Texts.category.count(n)}</span>
      {found ? <SearchBadge group={group} found={found} /> : null}
      {collapsed && !editing && picks.length
        ? <span class="cat-picks">{picks.map(o => <span key={o.id}>{o.text.trim() || '–'}</span>)}</span>
        : null}
      <span class="cat-end">
        {!editing && active ? (
          <span class="cat-progress" title={Texts.category.progressTitle(Model.nameOrUnnamed(active))}>
            {Texts.category.progress(picks.length, n) + (cost != null ? ` · ${money(cost)}` : '')}
          </span>
        ) : null}
        {editing ? (
          <span class="cat-tools">
            <button type="button" class="btn btn-small" onClick={() => addParameter(cid)}><Icon name="plus" />{Texts.category.addParameter}</button>
            {k ? <IconButton icon="up" label={Texts.category.moveUp} onClick={() => moveCategory(index, -1)} disabled={index <= 0} /> : null}
            {k ? <IconButton icon="down" label={Texts.category.moveDown} onClick={() => moveCategory(index, 1)} disabled={index >= state.categories.length - 1} /> : null}
            {k ? <IconButton icon="trash" label={Texts.category.delete} onClick={() => deleteCategory(k.id)} danger /> : null}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Trefferzahl einer Kategorie während der Suche (nichts, wenn sie keine Treffer hat).
 * @param {{ group: { items: Array<{ p: MatrixParameter }> }, found: NonNullable<Found> }} props
 */
function SearchBadge({ group, found }) {
  const n = found.hits.filter(x => group.items.some(({ p }) => p.id === x.pid)).length;
  return n ? <span class="search-badge">{Texts.search.hits(n)}</span> : null;
}

/** Chips über der Matrix: zu einer Kategorie springen, alle ein- bzw. ausklappen. */
function CategoryNav() {
  useMatrix();
  const show = state.categories.length > 0;
  useLayoutEffect(() => { $('#catNav').hidden = !show; });
  if (!show) return null;
  const active = activeConcept();
  const found = searchResult();
  const groups = Model.categoryGroups(state);
  const allCollapsed = groups.every(g => isCollapsed(g.cat ? g.cat.id : null));
  const allOpen = groups.every(g => !isCollapsed(g.cat ? g.cat.id : null));
  return (
    <>
      <div class="cat-chips">
        {groups.map(g => {
          const cid = g.cat ? g.cat.id : null;
          const { picks } = groupProgress(g, active);
          return (
            <button
              key={collapseKey(cid)} type="button" class={`cat-chip${isCollapsed(cid) ? ' is-collapsed' : ''}`}
              style={{ '--k': categoryColor(g.cat) }} title={Texts.category.jumpTo(Model.categoryLabel(g.cat))}
              onClick={() => jumpToCategory(cid)}
            >
              <span class="cat-dot" aria-hidden="true" />
              {Model.categoryLabel(g.cat)}
              {active ? <span class="cat-chip-count">{`${picks.length}/${g.items.length}`}</span> : null}
              {found ? <SearchBadge group={g} found={found} /> : null}
            </button>
          );
        })}
      </div>
      <div class="cat-nav-actions">
        <button type="button" class="btn btn-small" disabled={allOpen} onClick={() => setAllCollapsed(false)}>{Texts.category.expandAll}</button>
        <button type="button" class="btn btn-small" disabled={allCollapsed} onClick={() => setAllCollapsed(true)}>{Texts.category.collapseAll}</button>
      </div>
    </>
  );
}

/** Matrix und Kategorie-Navigation in ihre Container einhängen. */
export function initMatrix() {
  const matrix = $('#matrix');
  matrix.setAttribute('role', 'group');
  matrix.setAttribute('aria-label', Texts.matrix.label);
  mount(<Matrix />, matrix);
  mount(<CategoryNav />, $('#catNav'));
}

