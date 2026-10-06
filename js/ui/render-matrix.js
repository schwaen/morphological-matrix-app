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
  matrix.setAttribute('aria-label', 'Morphologische Matrix');

  const cells = [];
  if (!state.parameters.length) {
    cells.push(h('div', { class: 'matrix-empty' },
      editing ? 'Noch keine Parameter – fügen Sie unten den ersten hinzu.'
        : 'Noch keine Parameter. Wechseln Sie in den Modus „Bearbeiten“, um die Matrix aufzubauen.'));
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
      title: 'Ausprägung hinzufügen', 'aria-label': `Ausprägung zu ${Model.parameterLabel(p, pi)} hinzufügen`,
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
    placeholder: `Parameter ${pi + 1}`, 'aria-label': `Name von Parameter ${pi + 1}`,
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
          h('span', null, 'Gewicht'),
          numberField({
            value: p.weight, placeholder: '1', label: `Gewichtung von ${Model.parameterLabel(p, pi)}`,
            apply: n => { p.weight = n != null && n >= 0 ? n : null; },
            validate: n => n >= 0,
          }),
          h('span', { class: 'weight-pct', dataset: { weightPct: p.id } }, weightPercent(p)))
        : null,
      h('div', { class: 'row-tools' },
        iconBtn('up', 'Nach oben verschieben', () => moveParameter(pi, -1), { disabled: !Model.canMoveParameter(state, pi, -1) }),
        iconBtn('down', 'Nach unten verschieben', () => moveParameter(pi, 1), { disabled: !Model.canMoveParameter(state, pi, 1) }),
        iconBtn('trash', 'Parameter löschen', () => deleteParameter(p.id), { danger: true }),
      )));
}

function renderParameterView(p, pi) {
  return h('div', { class: 'param-cell', style: categoryStyle(p) },
    h('span', { class: 'param-label' }, Model.parameterLabel(p, pi)),
    h('span', { class: 'param-meta' },
      `${p.options.length} ${p.options.length === 1 ? 'Ausprägung' : 'Ausprägungen'}`
      + (state.settings.utility ? ` · Gewicht\u00a0${weightPercent(p)}` : '')));
}

function renderOptionEdit(p, pi, o, oi) {
  const ta = h('textarea', {
    class: 'autosize', rows: 1, value: o.text,
    placeholder: `Ausprägung ${oi + 1}`,
    'aria-label': `${Model.parameterLabel(p, pi)}: Ausprägung ${oi + 1}`,
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
  const optLabel = o.text.trim() || `Ausprägung ${oi + 1}`;
  const { costs, utility, currency, utilityMax } = state.settings;
  return h('div', { class: 'opt-cell edit' },
    h('div', { class: 'opt-main' }, ta),
    h('div', { class: 'opt-tools' },
      iconBtn('left', 'Nach links verschieben (Alt+←)', () => moveOption(p.id, oi, -1), { disabled: oi === 0 }),
      iconBtn('right', 'Nach rechts verschieben (Alt+→)', () => moveOption(p.id, oi, 1), { disabled: oi === p.options.length - 1 }),
      iconBtn('x', 'Ausprägung löschen', () => deleteOption(p.id, o.id), { danger: true })),
    costs || utility
      ? h('div', { class: 'opt-metrics' },
        costs
          ? h('label', { class: 'metric-field' },
            h('span', { class: 'metric-unit' }, Util.currencySymbol(currency)),
            numberField({ value: o.cost, placeholder: 'Kosten', label: `Kosten von ${optLabel}`, apply: n => { o.cost = n; } }))
          : null,
        utility
          ? h('label', { class: 'metric-field' },
            h('span', { class: 'metric-unit', title: 'Nutzwert (Erfüllungsgrad)' }, 'NW'),
            numberField({
              value: o.score, placeholder: `0–${utilityMax}`,
              label: `Nutzwert von ${optLabel} (0 bis ${utilityMax})`,
              apply: n => { o.score = n; },
              validate: n => n >= 0 && n <= utilityMax,
            }))
          : null)
      : null);
}

function renderOptionPick(p, o, oi, active) {
  const selectedBy = state.concepts.filter(c => c.selections[p.id] === o.id);
  const isActive = !!active && active.selections[p.id] === o.id;
  const metrics = optionMetricsText(o);
  return h('button', {
    type: 'button',
    class: `opt-cell pick${isActive ? ' is-active' : ''}${o.text.trim() ? '' : ' is-empty'}`,
    'aria-pressed': String(isActive),
    title: selectedBy.length ? `Gewählt in: ${selectedBy.map(Model.nameOrUnnamed).join(', ')}` : null,
    style: isActive ? { '--c': active.color } : null,
    dataset: { cell: `${p.id}:${o.id}` },
    onclick: () => toggleSelection(p.id, o.id),
  },
  h('span', { class: 'opt-label' },
    h('span', null, o.text.trim() || `(Ausprägung ${oi + 1})`),
    metrics ? h('span', { class: 'opt-metrics-view' }, metrics) : null),
  selectedBy.length
    ? h('span', { class: 'markers', 'aria-hidden': 'true' },
      selectedBy.map(c => h('span', { class: 'marker', style: { '--c': c.color } })))
    : null);
}

/** Kosten und Nutzwert einer Ausprägung für die Ansicht „Kombinieren“. @param {MatrixOption} o */
function optionMetricsText(o) {
  const parts = [];
  if (state.settings.costs && o.cost != null) parts.push(money(o.cost));
  if (state.settings.utility && o.score != null) parts.push(`NW ${Util.formatNumber(o.score)}`);
  return parts.join(' · ');
}

/** Gewichtsanteil eines Parameters als Text („25 %“). @param {MatrixParameter} p */
function weightPercent(p) {
  const share = Evaluation.weightShare(state, p);
  return share == null ? '–' : `${Util.formatNumber(Math.round(share * 1000) / 10)}\u00a0%`;
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
    class: 'cat-select', 'aria-label': `Kategorie von ${p.name || 'Parameter'}`, title: 'Kategorie',
    onchange: e => setParameterCategory(p.id, e.target.value),
  },
  h('option', { value: '', selected: !p.categoryId }, 'Ohne Kategorie'),
  state.categories.map(k => h('option', { value: k.id, selected: k.id === p.categoryId }, Model.nameOrUnnamed(k))),
  h('option', { value: NEW_CATEGORY }, '+ Neue Kategorie …'));
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
    title: collapsed ? 'Ausklappen' : 'Einklappen',
    'aria-label': `${label} ${collapsed ? 'ausklappen' : 'einklappen'}`,
    onclick: () => toggleCategory(cid),
  }, h('span', { class: 'cat-chevron', 'aria-hidden': 'true' }));

  let title;
  if (editing && k) {
    const color = h('input', { type: 'color', class: 'swatch cat-swatch', value: k.color, 'aria-label': `Farbe von ${k.name}`, title: 'Farbe ändern' });
    bindField(color, v => { k.color = v; }, () => { renderMatrix(); refreshLight(); });
    const name = h('input', {
      type: 'text', class: 'cat-name', value: k.name, placeholder: 'Kategorie',
      'aria-label': 'Name der Kategorie', dataset: { fid: `cat:${k.id}` },
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
  h('span', { class: 'cat-meta' }, `${n} Parameter`),
  collapsed && !editing && picks.length
    ? h('span', { class: 'cat-picks' }, picks.map(o => h('span', null, o.text.trim() || '–')))
    : null,
  h('span', { class: 'cat-end' },
    !editing && active
      ? h('span', { class: 'cat-progress', title: `Auswahl im Konzept „${Model.nameOrUnnamed(active)}“` },
        `${picks.length}/${n} gewählt` + (cost != null ? ` · ${money(cost)}` : ''))
      : null,
    editing
      ? h('span', { class: 'cat-tools' },
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => addParameter(cid) }, icon('plus'), 'Parameter'),
        k ? iconBtn('up', 'Kategorie nach oben', () => moveCategory(index, -1), { disabled: index <= 0 }) : null,
        k ? iconBtn('down', 'Kategorie nach unten', () => moveCategory(index, 1), { disabled: index >= state.categories.length - 1 }) : null,
        k ? iconBtn('trash', 'Kategorie löschen (Parameter bleiben erhalten)', () => deleteCategory(k.id), { danger: true }) : null)
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
        title: `Zu „${Model.categoryLabel(g.cat)}“ springen`,
        onclick: () => jumpToCategory(cid),
      },
      h('span', { class: 'cat-dot', 'aria-hidden': 'true' }),
      Model.categoryLabel(g.cat),
      active ? h('span', { class: 'cat-chip-count' }, `${picks.length}/${g.items.length}`) : null);
    })),
    h('div', { class: 'cat-nav-actions' },
      h('button', { type: 'button', class: 'btn btn-small', disabled: allOpen, onclick: () => setAllCollapsed(false) }, 'Alle ausklappen'),
      h('button', { type: 'button', class: 'btn btn-small', disabled: allCollapsed, onclick: () => setAllCollapsed(true) }, 'Alle einklappen')),
  );
}
