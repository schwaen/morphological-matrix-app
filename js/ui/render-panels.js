/*
 * Rendern außerhalb der Matrix: Kopfbereich, Kennzahlen, Konzeptliste,
 * Zusammenfassung, Konzeptvergleich und Sichtbarkeit der Konzept-Generatoren.
 */
'use strict';

/** Komplettes Neuzeichnen nach strukturellen Änderungen. */
function render() {
  document.title = Texts.app.documentTitle(state.title);
  // Tab-Leiste nicht neu zeichnen, während der Titel bearbeitet wird (Fokus bliebe sonst nicht erhalten)
  if (!(document.activeElement && document.activeElement.id === 'title')) renderTabs();
  const desc = $('#description');
  if (document.activeElement !== desc) desc.value = state.description;

  $$('.segmented button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === prefs.mode));
  });
  $('#showLines').checked = prefs.showLines;
  $('#addParamBtn').hidden = prefs.mode !== 'edit';
  $('#addCategoryBtn').hidden = prefs.mode !== 'edit';

  renderMatrix();
  renderConcepts();
  renderGenerators();
  refreshLight();
  syncSettingsForm();
  updateHistoryButtons();
  autosizeAll();
  applyPendingFocus();
}

/** Leichte Aktualisierung ohne Eingabefelder neu zu erzeugen (z. B. beim Tippen). */
function refreshLight() {
  updateWeightPercents();
  renderCategoryNav();
  renderStats();
  renderHint();
  renderSummary();
  renderCompare();
  updateProgress();
  scheduleLines();
}

function applyPendingFocus() {
  if (!pendingFocus) return;
  const fid = pendingFocus;
  pendingFocus = null;
  focusField(fid);
}

function updateHistoryButtons() {
  $('#undoBtn').disabled = !undoStack.length;
  $('#redoBtn').disabled = !redoStack.length;
}

function updateWeightPercents() {
  for (const p of state.parameters) {
    const el = $(`[data-weight-pct="${p.id}"]`);
    if (el) el.textContent = weightPercent(p);
  }
}

/**
 * Anzahl für die Kennzahl-Kachel: bis unter eine Billion exakt, darüber gerundet in Worten
 * (bzw. als Zehnerpotenz), damit die Zahl in die Kachel passt. Die exakte Zahl steht im Tooltip.
 * @param {bigint} n @returns {{ text: string, title: string | null }}
 */
function formatCount(n) {
  const exact = Util.formatInteger(n);
  if (n < 10n ** 12n) return { text: exact, title: null };
  const { value, power } = Util.scaleBigInt(n);
  const unit = Texts.stats.bigUnits[power];
  if (unit) {
    return { text: Texts.stats.approx(Util.formatNumber(Math.round(value * 10) / 10), unit), title: Texts.stats.exact(exact) };
  }
  const digits = n.toString();
  const mantissa = Number(`${digits[0]}.${digits.slice(1, 3)}`);
  return { text: Texts.stats.approxPower(Util.formatNumber(mantissa), digits.length - 1), title: Texts.stats.exact(exact) };
}

function renderStats() {
  const P = state.parameters.length;
  const O = state.parameters.reduce((n, p) => n + p.options.length, 0);
  const combos = P ? state.parameters.reduce((n, p) => n * BigInt(p.options.length), 1n) : 0n;
  const C = state.concepts.length;
  /** @param {string} value @param {string} label @param {string | null} [title] */
  const stat = (value, label, title = null) => h('span', { class: 'stat', title }, h('strong', null, value), ` ${label}`);
  const count = formatCount(combos);
  $('#stats').replaceChildren(
    stat(Util.formatInteger(P), Texts.stats.parameters),
    stat(Util.formatInteger(O), Texts.stats.options(O)),
    stat(count.text, Texts.stats.combinations(combos === 1n), count.title),
    stat(Util.formatInteger(C), Texts.stats.concepts(C)),
  );
}

function renderHint() {
  const c = activeConcept();
  $('#hint').textContent = prefs.mode === 'edit'
    ? Texts.hint.edit
    : (c ? Texts.hint.select(Model.nameOrUnnamed(c)) : Texts.hint.noConcept);
}

// ---------- Konzepte ----------

function renderConcepts() {
  const items = state.concepts.map((c, ci) => {
    const isActive = c.id === state.activeConceptId;
    const li = h('li', {
      class: `concept${isActive ? ' is-active' : ''}`,
      style: { '--c': c.color },
      dataset: { cid: c.id },
      onclick: e => {
        if (e.target.closest('button, input, textarea')) return;
        setActiveConcept(c.id);
      },
    });
    const color = h('input', { type: 'color', class: 'swatch', value: c.color, 'aria-label': Texts.concept.color(c.name), title: Texts.concept.changeColor });
    bindField(color, v => { c.color = v; }, () => {
      li.style.setProperty('--c', c.color);
      renderMatrix();
      refreshLight();
    });
    // Mehrzeilig, damit lange Namen vollständig lesbar bleiben; Zeilenumbrüche gehören nicht zum Namen.
    const name = h('textarea', {
      class: 'concept-name autosize', rows: 1, value: c.name,
      placeholder: Texts.fallback.concept(ci + 1), 'aria-label': Texts.concept.nameLabel(ci + 1),
      onfocus: () => setActiveConceptLight(c.id),
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } },
    });
    bindField(name, v => {
      const oneLine = v.replace(/[\r\n]+/g, ' ');
      if (oneLine !== v) name.value = oneLine; // z. B. eingefügter Text mit Zeilenumbrüchen
      c.name = oneLine;
    }, () => { autosize(name); refreshLight(); });
    li.append(
      color,
      name,
      h('span', { class: 'concept-progress', dataset: { progress: c.id } }),
      h('span', { class: 'concept-tools' },
        iconBtn('copy', Texts.concept.duplicate, () => duplicateConcept(c.id)),
        iconBtn('trash', Texts.concept.delete, () => deleteConcept(c.id), { danger: true })),
    );
    return li;
  });
  if (!items.length) items.push(h('li', { class: 'summary-empty' }, Texts.concept.none));
  $('#conceptList').replaceChildren(...items);
}

function updateProgress() {
  const total = state.parameters.length;
  for (const c of state.concepts) {
    const el = $(`[data-progress="${c.id}"]`);
    if (!el) continue;
    const filled = state.parameters.filter(p => c.selections[p.id]).length;
    el.textContent = `${filled}/${total}`;
    el.title = Texts.concept.progressTitle(filled, total);
  }
}

function renderGenerators() {
  let any = false;
  $$('[data-generate]').forEach(btn => {
    const gen = Evaluation.GENERATORS[btn.dataset.generate || ''];
    const on = !!gen && gen.available(state);
    btn.hidden = !on;
    any = any || on;
  });
  // Gruppen ohne verfügbare Knöpfe ausblenden (z. B. nur MoSCoW aktiv)
  $$('#autoConcepts .auto-buttons').forEach(group => {
    group.hidden = ![...group.querySelectorAll('button')].some(b => !b.hidden);
  });
  $('#autoMoscow').hidden = $('#autoMoscow .auto-buttons').hidden;
  $('#autoConcepts').hidden = !any;
}

/** „2 Werte fehlen“ bzw. leer. @param {number} missing */
function missingNote(missing) {
  return missing ? Texts.summary.missing(missing) : '';
}

function renderSummary() {
  const box = $('#conceptSummary');
  const c = activeConcept();
  if (!c) {
    box.replaceChildren(h('p', { class: 'summary-empty' }, Texts.summary.noConcept));
    return;
  }
  const showCats = state.categories.length > 0;
  const rows = Model.categoryGroups(state).flatMap(g => [
    showCats && g.items.length
      ? h('div', { class: 'summary-cat', style: { '--k': categoryColor(g.cat) } }, Model.categoryLabel(g.cat))
      : null,
    ...g.items.flatMap(({ p, pi }) => {
      const text = Model.optionText(p, c.selections[p.id]);
      return [
        h('dt', null, Model.parameterLabel(p, pi)),
        h('dd', text ? null : { class: 'none' }, text || Texts.summary.notSelected),
      ];
    }),
  ]);
  const fig = state.parameters.length ? Evaluation.conceptReport(state).find(r => r.concept === c) : null;
  const metric = (label, value, missing) => h('div', { class: 'metric' },
    h('span', null, label),
    h('strong', null, value),
    missing ? h('small', null, `(${missingNote(missing)})`) : null);
  const metrics = fig ? [
    fig.cost ? metric(Texts.summary.totalCost, money(fig.cost.total), fig.cost.missing) : null,
    fig.utility
      ? metric(Texts.summary.utility,
        fig.utility.value == null ? '–' : Texts.summary.utilityValue(Util.formatNumber(fig.utility.value), state.settings.utilityMax),
        fig.utility.missing)
      : null,
  ].filter(Boolean) : [];
  replaceWith(box,
    h('h3', { style: { '--c': c.color } }, c.name || Texts.fallback.unnamedConcept),
    metrics.length ? h('div', { class: 'metrics' }, metrics) : null,
    fig && fig.priority ? priorityProfileView(fig.priority, true) : null,
    rows.some(Boolean) ? h('dl', null, rows) : h('p', { class: 'summary-empty' }, Texts.summary.noParameters),
  );
}

/**
 * Prioritäten der gewählten Ausprägungen als Kürzel („2 × M“ …).
 * @param {Record<MatrixPriority | 'none', number>} counts @param {boolean} all auch Nullwerte zeigen
 */
function priorityProfileView(counts, all) {
  const pills = Model.PRIORITIES
    .filter(level => all || counts[level])
    .map(level => h('span', { class: `prio prio-${level}`, title: Texts.moscow.levels[level].label },
      `${counts[level]} × ${Texts.moscow.levels[level].short}`));
  if (counts.none) pills.push(h('span', { class: 'prio prio-none' }, `${counts.none} × ${Texts.moscow.none}`));
  return h('div', { class: 'prio-profile', title: Texts.moscow.profileTitle }, pills);
}

// ---------- Konzeptvergleich ----------

function renderCompare() {
  const section = $('#compareSection');
  if (!state.concepts.length || !state.parameters.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const open = prefs.compareOpen !== false;
  $('#compareToggle').setAttribute('aria-expanded', String(open));
  $('#compareBody').hidden = !open;
  const n = state.concepts.length;
  $('#compareMeta').textContent = Texts.compare.conceptCount(n);
  if (open) buildCompareTable();
}

/** Klassen einer Kennzahl-Zelle: unvollständig und/oder bester Wert. */
const metricClass = (incomplete, best) => [incomplete ? 'incomplete' : '', best ? 'best' : ''].join(' ').trim() || null;

function buildCompareTable() {
  const m = state;
  const head = h('thead', null, h('tr', null,
    h('th', { scope: 'col' }, Texts.compare.parameter),
    m.concepts.map(c => h('th', { scope: 'col', style: { '--c': c.color } }, h('span', { 'aria-hidden': 'true' }), Model.nameOrUnnamed(c)))));
  const showCats = m.categories.length > 0;
  const body = h('tbody', null, Model.categoryGroups(m).flatMap(g => [
    showCats && g.items.length
      ? h('tr', { class: 'cat-row', style: { '--k': categoryColor(g.cat) } },
        h('th', { scope: 'colgroup', colspan: String(m.concepts.length + 1) }, Model.categoryLabel(g.cat)))
      : null,
    ...g.items.map(({ p, pi }) => h('tr', null,
      h('th', { scope: 'row' }, Model.parameterLabel(p, pi)),
      m.concepts.map(c => {
        const text = Model.optionText(p, c.selections[p.id]);
        return h('td', text ? null : { class: 'none' }, text || '–');
      }))),
  ]));

  const report = Evaluation.conceptReport(m);
  /**
   * Eine Kennzahl-Zeile, falls die Bewertung aktiv ist (dann ist die jeweilige Kennzahl gesetzt).
   * @param {(r: ConceptFigures) => any} cellOf
   */
  const row = (th, active, cellOf) => (active ? h('tr', null, th, report.map(cellOf)) : null);
  const footRows = [
    row(h('th', { scope: 'row', title: Texts.moscow.profileTitle }, Texts.compare.priority), m.settings.moscow, ({ priority }) => priority &&
      h('td', null, priorityProfileView(priority, false),
        priority.wont ? h('small', { class: 'prio-note' }, Texts.moscow.wontNote(priority.wont)) : null)),
    row(h('th', { scope: 'row' }, Texts.compare.totalCost), m.settings.costs, ({ cost }) => cost &&
      h('td', { class: metricClass(cost.missing, cost.best), title: cost.missing ? missingNote(cost.missing) : null },
        money(cost.total) + (cost.missing ? ' *' : ''))),
    row(h('th', { scope: 'row' }, Texts.compare.utility(m.settings.utilityMax)), m.settings.utility, ({ utility }) => utility &&
      h('td', { class: metricClass(utility.missing, utility.best), title: utility.missing ? missingNote(utility.missing) : null },
        utility.value == null ? '–' : Util.formatNumber(utility.value) + (utility.missing ? ' *' : ''))),
    row(h('th', { scope: 'row', title: Texts.compare.priceValueTitle },
      Texts.compare.priceValue, h('small', { class: 'th-note' }, Texts.compare.priceValueNote)),
    m.settings.costs && m.settings.utility, ({ priceValue }) => priceValue &&
      h('td', { class: priceValue.value == null ? 'incomplete' : (priceValue.best ? 'best' : null), title: priceValue.reason },
        priceValue.value == null ? '–' : money(priceValue.value))),
  ].filter(Boolean);
  replaceWith($('#compareTable'), head, body, footRows.length ? h('tfoot', null, footRows) : null);
}
