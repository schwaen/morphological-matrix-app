/*
 * Rendern außerhalb der Matrix: Kopfbereich, Kennzahlen, Konzeptliste,
 * Zusammenfassung, Konzeptvergleich und Sichtbarkeit der Konzept-Generatoren.
 */
'use strict';

/** Komplettes Neuzeichnen nach strukturellen Änderungen. */
function render() {
  document.title = state.title ? `${state.title} – Morphologische Matrix` : 'Morphologische Matrix';
  const title = $('#title');
  if (document.activeElement !== title) title.value = state.title;
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

function renderStats() {
  const P = state.parameters.length;
  const O = state.parameters.reduce((n, p) => n + p.options.length, 0);
  const combos = P ? state.parameters.reduce((n, p) => n * BigInt(p.options.length), 1n) : 0n;
  const C = state.concepts.length;
  const stat = (value, label) => h('span', { class: 'stat' }, h('strong', null, value), ` ${label}`);
  $('#stats').replaceChildren(
    stat(P.toLocaleString('de-DE'), 'Parameter'),
    stat(O.toLocaleString('de-DE'), O === 1 ? 'Ausprägung' : 'Ausprägungen'),
    stat(combos.toLocaleString('de-DE'), combos === 1n ? 'mögliche Kombination' : 'mögliche Kombinationen'),
    stat(C.toLocaleString('de-DE'), C === 1 ? 'Konzept' : 'Konzepte'),
  );
}

function renderHint() {
  const c = activeConcept();
  $('#hint').textContent = prefs.mode === 'edit'
    ? 'Tipp: Mit Enter springen Sie zur nächsten Ausprägung bzw. legen eine neue an. Zum Kombinieren oben auf „Kombinieren“ wechseln.'
    : (c
      ? `Klicken Sie je Parameter auf eine Ausprägung, um sie dem Konzept „${Model.nameOrUnnamed(c)}“ zuzuordnen. Erneuter Klick hebt die Auswahl auf.`
      : 'Legen Sie ein Konzept an und wählen Sie dann je Parameter eine Ausprägung.');
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
        if (e.target.closest('button, input')) return;
        setActiveConcept(c.id);
      },
    });
    const color = h('input', { type: 'color', class: 'swatch', value: c.color, 'aria-label': `Farbe von ${c.name}`, title: 'Farbe ändern' });
    bindField(color, v => { c.color = v; }, () => {
      li.style.setProperty('--c', c.color);
      renderMatrix();
      refreshLight();
    });
    const name = h('input', {
      type: 'text', class: 'concept-name', value: c.name,
      placeholder: `Konzept ${ci + 1}`, 'aria-label': `Name von Konzept ${ci + 1}`,
      onfocus: () => setActiveConceptLight(c.id),
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    });
    bindField(name, v => { c.name = v; });
    li.append(
      color,
      name,
      h('span', { class: 'concept-progress', dataset: { progress: c.id } }),
      iconBtn('copy', 'Konzept duplizieren', () => duplicateConcept(c.id)),
      iconBtn('trash', 'Konzept löschen', () => deleteConcept(c.id), { danger: true }),
    );
    return li;
  });
  if (!items.length) items.push(h('li', { class: 'summary-empty' }, 'Noch keine Konzepte.'));
  $('#conceptList').replaceChildren(...items);
}

function updateProgress() {
  const total = state.parameters.length;
  for (const c of state.concepts) {
    const el = $(`[data-progress="${c.id}"]`);
    if (!el) continue;
    const filled = state.parameters.filter(p => c.selections[p.id]).length;
    el.textContent = `${filled}/${total}`;
    el.title = `${filled} von ${total} Parametern gewählt`;
  }
}

function renderGenerators() {
  let any = false;
  $$('[data-generate]').forEach(btn => {
    const gen = Evaluation.GENERATORS[btn.dataset.generate];
    const on = !!gen && gen.available(state);
    btn.hidden = !on;
    any = any || on;
  });
  $('#autoConcepts').hidden = !any;
}

/** „(2 Werte fehlen)“ bzw. leer. @param {number} missing */
function missingNote(missing) {
  return missing ? `${missing} ${missing === 1 ? 'Wert fehlt' : 'Werte fehlen'}` : '';
}

function renderSummary() {
  const box = $('#conceptSummary');
  const c = activeConcept();
  if (!c) {
    box.replaceChildren(h('p', { class: 'summary-empty' }, 'Kein Konzept ausgewählt.'));
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
        h('dd', text ? null : { class: 'none' }, text || 'nicht gewählt'),
      ];
    }),
  ]);
  const metrics = [];
  if (state.parameters.length && state.settings.costs) {
    const { total, missing } = Evaluation.conceptCost(state, c);
    metrics.push(h('div', { class: 'metric' },
      h('span', null, 'Gesamtkosten'),
      h('strong', null, money(total)),
      missing ? h('small', null, `(${missingNote(missing)})`) : null));
  }
  if (state.parameters.length && state.settings.utility) {
    const { value, missing } = Evaluation.conceptUtility(state, c);
    metrics.push(h('div', { class: 'metric' },
      h('span', null, 'Nutzwert'),
      h('strong', null, value == null ? '–' : `${Util.formatNumber(value)} / ${state.settings.utilityMax}`),
      missing ? h('small', null, `(${missingNote(missing)})`) : null));
  }
  replaceWith(box,
    h('h3', { style: { '--c': c.color } }, c.name || 'Unbenanntes Konzept'),
    metrics.length ? h('div', { class: 'metrics' }, metrics) : null,
    rows.some(Boolean) ? h('dl', null, rows) : h('p', { class: 'summary-empty' }, 'Die Matrix enthält noch keine Parameter.'),
  );
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
  $('#compareMeta').textContent = `${n} ${n === 1 ? 'Konzept' : 'Konzepte'}`;
  if (open) buildCompareTable();
}

/** Klassen einer Kennzahl-Zelle: unvollständig und/oder bester Wert. */
const metricClass = (incomplete, best) => [incomplete ? 'incomplete' : '', best ? 'best' : ''].join(' ').trim() || null;

function buildCompareTable() {
  const m = state;
  const head = h('thead', null, h('tr', null,
    h('th', { scope: 'col' }, 'Parameter'),
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

  const footRows = [];
  if (m.settings.costs) {
    const costs = m.concepts.map(c => Evaluation.conceptCost(m, c));
    const complete = costs.filter(x => !x.missing).map(x => x.total);
    const best = complete.length > 1 ? Math.min(...complete) : null;
    footRows.push(h('tr', null, h('th', { scope: 'row' }, 'Gesamtkosten'),
      costs.map(x => h('td', {
        class: metricClass(x.missing, !x.missing && x.total === best),
        title: x.missing ? missingNote(x.missing) : null,
      }, money(x.total) + (x.missing ? ' *' : '')))));
  }
  if (m.settings.utility) {
    const utils = m.concepts.map(c => Evaluation.conceptUtility(m, c));
    const values = utils.filter(x => x.value != null).map(x => x.value);
    const best = values.length > 1 ? Math.max(...values) : null;
    footRows.push(h('tr', null, h('th', { scope: 'row' }, `Nutzwert (max. ${m.settings.utilityMax})`),
      utils.map(x => h('td', {
        class: metricClass(x.missing, x.value != null && x.value === best),
        title: x.missing ? missingNote(x.missing) : null,
      }, x.value == null ? '–' : Util.formatNumber(x.value) + (x.missing ? ' *' : '')))));
  }
  if (m.settings.costs && m.settings.utility) {
    const ratios = m.concepts.map(c => Evaluation.priceValue(m, c));
    const values = ratios.filter(x => x.value != null).map(x => x.value);
    const best = values.length > 1 ? Math.min(...values) : null;
    footRows.push(h('tr', null,
      h('th', { scope: 'row', title: 'Gesamtkosten geteilt durch Nutzwert – je niedriger, desto besser' },
        'Preis-Leistung', h('small', { class: 'th-note' }, 'Kosten je Nutzwertpunkt')),
      ratios.map(x => h('td', {
        class: x.value == null ? 'incomplete' : (x.value === best ? 'best' : null),
        title: x.reason,
      }, x.value == null ? '–' : money(x.value)))));
  }
  replaceWith($('#compareTable'), head, body, footRows.length ? h('tfoot', null, footRows) : null);
}
