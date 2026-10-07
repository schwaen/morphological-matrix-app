/*
 * Rendern der Matrix: Parameterzeilen, Ausprägungen (Bearbeiten/Kombinieren),
 * Kategorie-Bänder und die Kategorie-Navigation über der Matrix.
 */
'use strict';

function renderMatrix() {
  const matrix = $('#matrix');
  const editing = prefs.mode === 'edit';
  const maxOptions = Math.max(1, ...state.parameters.map(p => p.options.length));
  const cols = maxOptions + (editing ? 1 : 0);
  matrix.style.setProperty('--cols', cols);
  matrix.classList.toggle('is-editing', editing);
  matrix.classList.toggle('is-selecting', !editing);
  matrix.setAttribute('role', 'group');
  matrix.setAttribute('aria-label', Texts.matrix.label);

  const cells = [];
  if (!state.parameters.length) {
    cells.push(h('div', { class: 'matrix-empty' },
      editing ? Texts.matrix.emptyEdit : Texts.matrix.emptySelect));
  }

  const ctx = { editing, cols, active: activeConcept(), showBands: state.categories.length > 0 };
  for (const group of Model.categoryGroups(state)) {
    const cid = group.cat ? group.cat.id : null;
    if (ctx.showBands) cells.push(renderBand(group, editing, ctx.active));
    if (ctx.showBands && isCollapsed(cid)) continue;
    group.items.forEach(({ p, pi }) => cells.push(...renderParameterRow(p, pi, ctx)));
  }

  matrix.replaceChildren(...cells);
}

/**
 * Alle Gitterzellen einer Parameterzeile (Kopf, Ausprägungen, Plus-Knopf, Füllzellen).
 * @param {MatrixParameter} p @param {number} pi
 * @param {{ editing: boolean, cols: number, active: MatrixConcept | null, showBands: boolean }} ctx
 */
function renderParameterRow(p, pi, ctx) {
  const cells = [ctx.editing ? renderParameterEdit(p, pi, ctx.showBands) : renderParameterView(p, pi)];
  p.options.forEach((o, oi) => {
    cells.push(ctx.editing ? renderOptionEdit(p, pi, o, oi) : renderOptionPick(p, o, oi, ctx.active));
  });
  let used = p.options.length;
  if (ctx.editing) {
    cells.push(h('button', {
      type: 'button', class: 'add-opt',
      title: Texts.matrix.addOption, 'aria-label': Texts.matrix.addOptionTo(Model.parameterLabel(p, pi)),
      onclick: () => addOption(p.id),
    }, icon('plus')));
    used += 1;
  }
  for (let i = used; i < ctx.cols; i++) cells.push(h('div', { 'aria-hidden': 'true' }));
  return cells;
}

function renderParameterEdit(p, pi, showBands) {
  const name = h('textarea', {
    class: 'param-name autosize', rows: 1, value: p.name,
    placeholder: Texts.fallback.parameter(pi + 1), 'aria-label': Texts.matrix.parameterName(pi + 1),
    dataset: { fid: `param:${p.id}` },
    onkeydown: e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (p.options.length) focusField(`opt:${p.options[0].id}`);
        else addOption(p.id);
      }
    },
  });
  bindField(name, v => { p.name = v; });
  return h('div', { class: 'param-cell', style: categoryStyle(p) },
    name,
    showBands ? categorySelect(p) : null,
    h('div', { class: 'param-foot' },
      state.settings.utility
        ? h('label', { class: 'weight-field' },
          h('span', null, Texts.matrix.weight),
          numberField({
            value: p.weight, placeholder: '1', label: Texts.matrix.weightOf(Model.parameterLabel(p, pi)),
            apply: n => { p.weight = n != null && n >= 0 ? n : null; },
            validate: n => n >= 0,
          }),
          h('span', { class: 'weight-pct', dataset: { weightPct: p.id } }, weightPercent(p)))
        : null,
      h('div', { class: 'row-tools' },
        iconBtn('up', Texts.matrix.moveUp, () => moveParameter(pi, -1), { disabled: !Model.canMoveParameter(state, pi, -1) }),
        iconBtn('down', Texts.matrix.moveDown, () => moveParameter(pi, 1), { disabled: !Model.canMoveParameter(state, pi, 1) }),
        iconBtn('trash', Texts.matrix.deleteParameter, () => deleteParameter(p.id), { danger: true }),
      )));
}

function renderParameterView(p, pi) {
  return h('div', { class: 'param-cell', style: categoryStyle(p) },
    h('span', { class: 'param-label' }, Model.parameterLabel(p, pi)),
    h('span', { class: 'param-meta' },
      Texts.matrix.optionCount(p.options.length)
      + (state.settings.utility ? ` · ${Texts.matrix.weightShare(weightPercent(p))}` : '')));
}

function renderOptionEdit(p, pi, o, oi) {
  const ta = h('textarea', {
    class: 'autosize', rows: 1, value: o.text,
    placeholder: Texts.fallback.option(oi + 1),
    'aria-label': Texts.matrix.optionField(Model.parameterLabel(p, pi), oi + 1),
    dataset: { fid: `opt:${o.id}` },
    onkeydown: e => {
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
      } else if (e.key === 'Backspace' && !ta.value && p.options.length > 1) {
        e.preventDefault();
        const prev = p.options[oi - 1] || p.options[oi + 1];
        pendingFocus = `opt:${prev.id}`;
        deleteOption(p.id, o.id);
      }
    },
  });
  bindField(ta, v => { o.text = v; });
  const optLabel = o.text.trim() || Texts.fallback.option(oi + 1);
  const { costs, utility, currency, utilityMax, moscow } = state.settings;
  return h('div', { class: 'opt-cell edit' },
    h('div', { class: 'opt-main' }, ta),
    h('div', { class: 'opt-tools' },
      iconBtn('left', Texts.matrix.moveLeft, () => moveOption(p.id, oi, -1), { disabled: oi === 0 }),
      iconBtn('right', Texts.matrix.moveRight, () => moveOption(p.id, oi, 1), { disabled: oi === p.options.length - 1 }),
      iconBtn('x', Texts.matrix.deleteOption, () => deleteOption(p.id, o.id), { danger: true })),
    costs || utility
      ? h('div', { class: 'opt-metrics' },
        costs
          ? h('label', { class: 'metric-field' },
            h('span', { class: 'metric-unit' }, Util.currencySymbol(currency)),
            numberField({ value: o.cost, placeholder: Texts.matrix.costPlaceholder, label: Texts.matrix.costOf(optLabel), apply: n => { o.cost = n; } }))
          : null,
        utility
          ? h('label', { class: 'metric-field' },
            h('span', { class: 'metric-unit', title: Texts.matrix.utilityUnitTitle }, Texts.matrix.utilityUnit),
            numberField({
              value: o.score, placeholder: `0–${utilityMax}`,
              label: Texts.matrix.utilityOf(optLabel, utilityMax),
              apply: n => { o.score = n; },
              validate: n => n >= 0 && n <= utilityMax,
            }))
          : null)
      : null,
    moscow ? priorityPicker(p, o, optLabel) : null);
}

/** Auswahl M/S/C/W; erneuter Klick auf die gewählte Priorität entfernt sie. */
function priorityPicker(p, o, optLabel) {
  return h('div', { class: 'opt-prio', role: 'group', 'aria-label': Texts.moscow.groupLabel },
    h('span', { class: 'metric-unit', 'aria-hidden': 'true' }, Texts.moscow.short),
    Model.PRIORITIES.map(level => {
      const { short, label } = Texts.moscow.levels[level];
      return h('button', {
        type: 'button', class: `prio-btn prio-${level}`, 'aria-pressed': String(o.priority === level),
        title: level === 'wont' ? Texts.moscow.wontHint : label,
        'aria-label': Texts.moscow.setLabel(label, optLabel),
        onclick: () => setPriority(p.id, o.id, level),
      }, short);
    }));
}

/** Kürzel der Priorität (M/S/C/W) oder `null`. @param {MatrixOption} o */
function priorityBadge(o) {
  if (!state.settings.moscow || !o.priority) return null;
  const { short, label } = Texts.moscow.levels[o.priority];
  return h('span', { class: `prio prio-${o.priority}`, title: o.priority === 'wont' ? Texts.moscow.wontHint : label }, short);
}

function renderOptionPick(p, o, oi, active) {
  const selectedBy = state.concepts.filter(c => c.selections[p.id] === o.id);
  const isActive = !!active && active.selections[p.id] === o.id;
  const metrics = optionMetricsText(o);
  const badge = priorityBadge(o);
  return h('button', {
    type: 'button',
    class: `opt-cell pick${isActive ? ' is-active' : ''}${o.text.trim() ? '' : ' is-empty'}${state.settings.moscow && o.priority === 'wont' ? ' is-wont' : ''}`,
    'aria-pressed': String(isActive),
    title: selectedBy.length ? Texts.matrix.selectedIn(selectedBy.map(Model.nameOrUnnamed).join(', ')) : null,
    style: isActive ? { '--c': shownColor(active.color) } : null,
    dataset: { cell: `${p.id}:${o.id}` },
    onclick: () => toggleSelection(p.id, o.id),
  },
  h('span', { class: 'opt-label' },
    h('span', null, o.text.trim() || Texts.fallback.emptyOption(oi + 1)),
    metrics || badge ? h('span', { class: 'opt-metrics-view' }, badge, metrics) : null),
  selectedBy.length
    ? h('span', { class: 'markers', 'aria-hidden': 'true' },
      selectedBy.map(c => h('span', { class: 'marker', style: { '--c': shownColor(c.color) } })))
    : null);
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
 * Eingabefeld für Zahlen; speichert beim Tippen, formatiert beim Verlassen.
 * @param {{ value: number | null, label: string, placeholder?: string, fid?: string,
 *           apply: (n: number | null) => void, validate?: (n: number) => boolean }} opts
 */
function numberField({ value, label, placeholder, fid, apply, validate }) {
  const input = h('input', {
    type: 'text', inputmode: 'decimal', class: 'num-input', value: Util.numberToInput(value),
    placeholder, 'aria-label': label, title: label, dataset: fid ? { fid } : null,
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });
  const check = n => {
    const bad = Number.isNaN(n) || (n != null && !!validate && !validate(n));
    input.toggleAttribute('aria-invalid', bad);
  };
  bindField(input, v => {
    const n = Util.parseNumber(v);
    check(n);
    apply(Number.isNaN(n) ? null : n);
  });
  input.addEventListener('blur', () => {
    const n = Util.parseNumber(input.value);
    if (!Number.isNaN(n)) input.value = Util.numberToInput(n);
  });
  check(value);
  return input;
}

// ---------- Kategorien ----------

/** @param {MatrixParameter} p */
function categoryStyle(p) {
  const k = Model.categoryById(state, p.categoryId);
  return k ? { '--k': k.color } : null;
}

/** @param {MatrixCategory | null} k */
const categoryColor = k => (k ? k.color : 'var(--muted)');

/** @param {MatrixParameter} p */
function categorySelect(p) {
  return h('select', {
    class: 'cat-select', 'aria-label': Texts.category.select(p.name || Texts.compare.parameter), title: Texts.category.selectTitle,
    onchange: e => setParameterCategory(p.id, e.target.value),
  },
  h('option', { value: '', selected: !p.categoryId }, Texts.fallback.noCategory),
  state.categories.map(k => h('option', { value: k.id, selected: k.id === p.categoryId }, Model.nameOrUnnamed(k))),
  h('option', { value: NEW_CATEGORY }, Texts.category.newOption));
}

/** Auswahl des aktiven Konzepts innerhalb einer Gruppe (und deren Kosten, falls vollständig). */
function groupProgress(group, concept) {
  const picks = concept ? group.items.map(({ p }) => Model.selectedOption(p, concept)).filter(Boolean) : [];
  const cost = state.settings.costs && picks.length && picks.every(o => o.cost != null)
    ? picks.reduce((s, o) => s + o.cost, 0) : null;
  return { picks, cost };
}

function renderBand(group, editing, active) {
  const k = group.cat;
  const cid = k ? k.id : null;
  const collapsed = isCollapsed(cid);
  const n = group.items.length;
  const { picks, cost } = groupProgress(group, active);
  const index = k ? state.categories.indexOf(k) : -1;
  const label = Model.categoryLabel(k);
  const toggle = h('button', {
    type: 'button', class: 'cat-toggle', 'aria-expanded': String(!collapsed),
    title: collapsed ? Texts.category.expand : Texts.category.collapse,
    'aria-label': Texts.category.toggle(label, collapsed),
    onclick: () => toggleCategory(cid),
  }, h('span', { class: 'cat-chevron', 'aria-hidden': 'true' }));

  let title;
  if (editing && k) {
    const color = h('input', { type: 'color', class: 'swatch cat-swatch', value: k.color, 'aria-label': Texts.category.color(k.name), title: Texts.category.changeColor });
    bindField(color, v => { k.color = v; }, () => { renderMatrix(); refreshLight(); });
    const name = h('input', {
      type: 'text', class: 'cat-name', value: k.name, placeholder: Texts.category.namePlaceholder,
      'aria-label': Texts.category.nameLabel, dataset: { fid: `cat:${k.id}` },
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    });
    bindField(name, v => { k.name = v; });
    title = [color, name];
  } else {
    title = [h('span', { class: 'cat-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'cat-title', onclick: () => toggleCategory(cid) }, label)];
  }

  return h('div', {
    class: `cat-band${collapsed ? ' is-collapsed' : ''}${k ? '' : ' is-none'}`,
    style: { '--k': categoryColor(k) },
    dataset: { catBand: collapseKey(cid) },
  },
  toggle,
  title,
  h('span', { class: 'cat-meta' }, Texts.category.count(n)),
  collapsed && !editing && picks.length
    ? h('span', { class: 'cat-picks' }, picks.map(o => h('span', null, o.text.trim() || '–')))
    : null,
  h('span', { class: 'cat-end' },
    !editing && active
      ? h('span', { class: 'cat-progress', title: Texts.category.progressTitle(Model.nameOrUnnamed(active)) },
        Texts.category.progress(picks.length, n) + (cost != null ? ` · ${money(cost)}` : ''))
      : null,
    editing
      ? h('span', { class: 'cat-tools' },
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => addParameter(cid) }, icon('plus'), Texts.category.addParameter),
        k ? iconBtn('up', Texts.category.moveUp, () => moveCategory(index, -1), { disabled: index <= 0 }) : null,
        k ? iconBtn('down', Texts.category.moveDown, () => moveCategory(index, 1), { disabled: index >= state.categories.length - 1 }) : null,
        k ? iconBtn('trash', Texts.category.delete, () => deleteCategory(k.id), { danger: true }) : null)
      : null));
}

function renderCategoryNav() {
  const nav = $('#catNav');
  if (!state.categories.length) {
    nav.hidden = true;
    return;
  }
  nav.hidden = false;
  const active = activeConcept();
  const groups = Model.categoryGroups(state);
  const allCollapsed = groups.every(g => isCollapsed(g.cat ? g.cat.id : null));
  const allOpen = groups.every(g => !isCollapsed(g.cat ? g.cat.id : null));
  replaceWith(nav,
    h('div', { class: 'cat-chips' }, groups.map(g => {
      const cid = g.cat ? g.cat.id : null;
      const { picks } = groupProgress(g, active);
      return h('button', {
        type: 'button',
        class: `cat-chip${isCollapsed(cid) ? ' is-collapsed' : ''}`,
        style: { '--k': categoryColor(g.cat) },
        title: Texts.category.jumpTo(Model.categoryLabel(g.cat)),
        onclick: () => jumpToCategory(cid),
      },
      h('span', { class: 'cat-dot', 'aria-hidden': 'true' }),
      Model.categoryLabel(g.cat),
      active ? h('span', { class: 'cat-chip-count' }, `${picks.length}/${g.items.length}`) : null);
    })),
    h('div', { class: 'cat-nav-actions' },
      h('button', { type: 'button', class: 'btn btn-small', disabled: allOpen, onclick: () => setAllCollapsed(false) }, Texts.category.expandAll),
      h('button', { type: 'button', class: 'btn btn-small', disabled: allCollapsed, onclick: () => setAllCollapsed(true) }, Texts.category.collapseAll)),
  );
}
