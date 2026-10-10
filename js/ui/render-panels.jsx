/*
 * Alles außerhalb der Matrix: Kennzahlen, Konzeptliste, Zusammenfassung und Inhalt des
 * Konzeptvergleichs (Tabelle; Verlauf in render-chart.jsx, Rahmen in chrome.jsx).
 */
import { Fragment, render as mount } from 'preact';
import { Attributes } from '../attributes.js';
import { Consistency } from '../consistency.js';
import { Evaluation } from '../evaluation.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { deleteConcept, duplicateConcept, setActiveConcept } from './actions.js';
import { Icon, IconButton } from './components.jsx';
import { ConflictBox, ConflictPill, pairLabel } from './constraints.jsx';
import { activeConcept, fieldProps, money, prefs, render, state, useMatrix } from './core.js';
import { consistentCount, restCounts } from './count.js';
import { $, shownColor } from './dom.jsx';
import { hoverConcept } from './lines.js';
import { categoryColor } from './render-matrix.jsx';
import { openSolutions } from './solutions.jsx';
import { StatusChip } from './status.jsx';
import { Util } from '../util.js';

/**
 * Anzahl für die Kennzahl-Kachel: bis unter eine Billion exakt, darüber gerundet in Worten
 * (bzw. als Zehnerpotenz), damit die Zahl in die Kachel passt. Die exakte Zahl steht im Tooltip.
 * @param {bigint} n @returns {{ text: string, title: string | null }}
 */
export function formatCount(n) {
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

// ---------- Kennzahlen ----------

/** @param {{ value: string, label: string, title?: string | null, children?: any }} props */
function Stat({ value, label, title = null, children }) {
  return <span class="stat" title={title ?? undefined}>{children}<strong>{value}</strong>{` ${label}`}</span>;
}

function Stats() {
  useMatrix();
  const P = state.parameters.length;
  const O = state.parameters.reduce((n, p) => n + p.options.length, 0);
  const combos = P ? state.parameters.reduce((n, p) => n * BigInt(p.options.length), 1n) : 0n;
  const C = state.concepts.length;
  const count = formatCount(combos);
  /** @type {Array<Exclude<ConceptStatus, 'draft'>>} */
  const shown = ['chosen', 'favorite', 'dropped'];
  const parts = shown.map(s => [s, state.concepts.filter(c => c.status === s).length])
    .filter(([, n]) => n).map(([s, n]) => Texts.status.count(/** @type {number} */ (n), /** @type {any} */ (s)));
  const statusSummary = parts.length ? Texts.status.summary(parts) : '';
  return (
    <>
      <Stat value={Util.formatInteger(P)} label={Texts.stats.parameters} />
      <Stat value={Util.formatInteger(O)} label={Texts.stats.options(O)} />
      <Stat value={count.text} label={Texts.stats.combinations(combos === 1n)} title={count.title}>
        {/* Spaltenrichtung umgekehrt: zuerst genannt steht ganz unten */}
        {P ? <button type="button" class="stat-link" id="solutionsLink" title={Texts.solutions.openTitle} onClick={openSolutions}>{Texts.solutions.open}</button> : null}
        {state.constraints.some(x => x.type === 'excluded') ? <ConsistentCount /> : null}
      </Stat>
      <Stat value={Util.formatInteger(C)} label={Texts.stats.concepts(C)}>
        {statusSummary ? <span class="stat-note">{statusSummary}</span> : null}
      </Stat>
    </>
  );
}

/** Anteil der widerspruchsfreien Kombinationen (gezählt im Web Worker; bis dahin der letzte Wert). */
function ConsistentCount() {
  useMatrix();
  const { value: ok, pending } = consistentCount(state);
  const okText = ok === undefined ? '…' : ok == null ? Texts.cons.notCountable : formatCount(ok).text;
  const left = conceptRest(activeConcept());
  return (
    <span class="stat-sub" title={ok == null ? undefined : formatCount(ok).title ?? undefined} aria-busy={pending || undefined}>
      {Texts.cons.consistentCount(okText)}
      {left != null ? <>{' · '}<span class="stat-rest">{Texts.cons.restStat(formatCount(left).text)}</span></> : null}
    </span>
  );
}

/**
 * Wie viele widerspruchsfreie Lösungen die Auswahl eines teilweise ausgefüllten Konzepts
 * noch zulässt (nur beim Kombinieren; sonst `null`). @param {MatrixConcept | null} c
 */
function conceptRest(c) {
  if (!c || prefs.mode !== 'select') return null;
  const filled = state.parameters.filter(p => c.selections[p.id]).length;
  if (!filled || filled === state.parameters.length || c.id !== state.activeConceptId) return null;
  const rest = restCounts(state, c);
  return rest ? rest.total : null;
}

// ---------- Konzepte ----------

function ConceptList() {
  useMatrix();
  if (!state.concepts.length) return <li class="summary-empty">{Texts.concept.none}</li>;
  return <>{state.concepts.map((c, ci) => <ConceptItem key={c.id} c={c} ci={ci} />)}</>;
}

/** @param {{ c: MatrixConcept, ci: number }} props */
function ConceptItem({ c, ci }) {
  const total = state.parameters.length;
  const filled = state.parameters.filter(p => c.selections[p.id]).length;
  const name = fieldProps(v => { c.name = v.replace(/[\r\n]+/g, ' '); });
  const left = conceptRest(c);
  return (
    <li
      class={`concept${c.id === state.activeConceptId ? ' is-active' : ''}${c.status === 'dropped' ? ' is-dropped' : ''}`}
      style={{ '--c': shownColor(c.color) }} data-cid={c.id}
      onMouseEnter={() => hoverConcept(c.id)} onMouseLeave={() => hoverConcept(null)}
      onClick={e => { if (!/** @type {HTMLElement} */ (e.target).closest('button, input, textarea')) setActiveConcept(c.id); }}
    >
      <input
        type="color" class="swatch" value={c.color} aria-label={Texts.concept.color(c.name)} title={Texts.concept.changeColor}
        {...fieldProps(v => { c.color = v; }, render)}
      />
      {/* Mehrzeilig, damit lange Namen vollständig lesbar bleiben; Zeilenumbrüche gehören nicht zum Namen. */}
      <textarea
        class="concept-name autosize" rows={1} value={c.name}
        placeholder={Texts.fallback.concept(ci + 1)} aria-label={Texts.concept.nameLabel(ci + 1)}
        {...name}
        onFocus={e => { setActiveConcept(c.id); name.onFocus(e); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); /** @type {HTMLElement} */ (e.currentTarget).blur(); } }}
      />
      <span class="concept-meta">
        <ConflictPill c={c} />
        <span class="concept-progress" data-progress={c.id} title={Texts.concept.progressTitle(filled, total)}>{`${filled}/${total}`}</span>
      </span>
      <span class="concept-tools">
        <IconButton icon="copy" label={Texts.concept.duplicate} onClick={() => duplicateConcept(c.id)} />
        <IconButton icon="trash" label={Texts.concept.delete} onClick={() => deleteConcept(c.id)} danger />
      </span>
      <span class="concept-status">
        <StatusChip c={c} />
        {c.statusNote.trim() ? <span class="status-why">{c.statusNote}</span> : null}
      </span>
      {left != null ? <span class="concept-rest">{Texts.cons.restConcept(formatCount(left).text, left === 1n)}</span> : null}
    </li>
  );
}

/** „2 Werte fehlen“ bzw. leer. @param {number} missing */
function missingNote(missing) {
  return missing ? Texts.summary.missing(missing) : '';
}

// ---------- Zusammenfassung ----------

function Summary() {
  useMatrix();
  const c = activeConcept();
  if (!c) return <p class="summary-empty">{Texts.summary.noConcept}</p>;
  const showCats = state.categories.length > 0;
  const groups = Model.categoryGroups(state);
  const fig = state.parameters.length ? Evaluation.conceptReport(state).find(r => r.concept === c) : null;
  /** @param {string} label @param {string} value @param {number} missing */
  const metric = (label, value, missing) => (
    <div class="metric"><span>{label}</span><strong>{value}</strong>{missing ? <small>{`(${missingNote(missing)})`}</small> : null}</div>
  );
  const metrics = fig ? [
    fig.cost ? metric(Texts.summary.totalCost, money(fig.cost.total), fig.cost.missing) : null,
    fig.utility
      ? metric(Texts.summary.utility,
        fig.utility.value == null ? '–' : Texts.summary.utilityValue(Util.formatNumber(fig.utility.value), state.settings.utilityMax),
        fig.utility.missing)
      : null,
    ...state.settings.attributes.map((a, i) => {
      const sum = Attributes.summarize(state, a, c);
      if (!sum.text) return null;
      const star = sum.missing > 0 && a.type !== 'text' && a.type !== 'bool' && a.aggregate !== 'none';
      return (
        <div key={a.id} class={`metric metric-attr${sum.warn ? ' is-warn' : ''}`}>
          <span>{Attributes.label(a, i)}</span>
          <strong>{sum.text}</strong>
          {star ? <small>{`(${missingNote(sum.missing)})`}</small> : null}
          {sum.warn ? <small class="attr-warn">{`⚠ ${Attributes.limitText(a)}`}</small> : null}
        </div>
      );
    }),
  ].filter(Boolean) : [];
  return (
    <>
      <h3 style={{ '--c': shownColor(c.color) }}>{c.name || Texts.fallback.unnamedConcept}</h3>
      <ConflictBox c={c} />
      <div class="concept-note" data-cid={c.id} key={c.id}>
        <label for="conceptNote">{Texts.notes.conceptLabel}</label>
        <textarea
          id="conceptNote" class="autosize" rows={2} value={c.note} placeholder={Texts.notes.conceptPlaceholder}
          {...fieldProps(v => { c.note = v; })}
        />
      </div>
      {metrics.length ? <div class="metrics">{metrics}</div> : null}
      {fig && fig.priority ? <PriorityProfile counts={fig.priority} all /> : null}
      {state.parameters.length ? (
        <dl>
          {groups.map(g => (
            <Fragment key={g.cat ? g.cat.id : ''}>
              {showCats && g.items.length
                ? <div class="summary-cat" style={{ '--k': categoryColor(g.cat) }}>{Model.categoryLabel(g.cat)}</div>
                : null}
              {g.items.map(({ p, pi }) => {
                const text = Model.optionText(p, c.selections[p.id]);
                const o = Model.selectedOption(p, c);
                return (
                  <Fragment key={p.id}>
                    <dt>{Model.parameterLabel(p, pi)}</dt>
                    <dd class={text ? undefined : 'none'}>
                      {text || Texts.summary.notSelected}
                      {o && o.note ? <span class="dd-note">{o.note}</span> : null}
                    </dd>
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </dl>
      ) : <p class="summary-empty">{Texts.summary.noParameters}</p>}
    </>
  );
}

/**
 * Prioritäten der gewählten Ausprägungen als Kürzel („2 × M“ …).
 * @param {{ counts: Record<MatrixPriority | 'none', number>, all?: boolean }} props `all`: auch Nullwerte zeigen
 */
function PriorityProfile({ counts, all = false }) {
  return (
    <div class="prio-profile" title={Texts.moscow.profileTitle}>
      {Model.PRIORITIES.filter(level => all || counts[level]).map(level => (
        <span key={level} class={`prio prio-${level}`} title={Texts.moscow.levels[level].label}>
          {`${counts[level]} × ${Texts.moscow.levels[level].short}`}
        </span>
      ))}
      {counts.none ? <span class="prio prio-none">{`${counts.none} × ${Texts.moscow.none}`}</span> : null}
    </div>
  );
}

// ---------- Konzeptvergleich ----------

/**
 * Inhalt des Konzeptvergleichs: Konzepte in der gewählten Reihenfolge (mit Rang) und die
 * Parametergruppen – bei „Nur Unterschiede“ ohne Parameter, die alle Konzepte gleich gewählt haben.
 * @returns {CompareContent}
 */
export function compareContent() {
  const m = state;
  const report = Evaluation.conceptReport(m);
  const hide = prefs.compareHideConflicts && m.constraints.some(x => x.type === 'excluded');
  const ranked = Evaluation.rankConcepts(m, report, prefs.compareSort || 'order')
    .filter(({ figures: { concept: c } }) => !hide || !Consistency.conflicts(m, c).excluded.length)
    .filter(({ figures: { concept: c } }) => !prefs.compareHideDropped || c.status !== 'dropped');
  const diff = prefs.compareDiff && m.concepts.length > 1 ? Model.differingParameters(m) : null;
  const groups = Model.categoryGroups(m).map(g => ({ ...g, items: diff ? g.items.filter(({ p }) => diff.has(p.id)) : g.items }));
  return { ranked, groups, filtered: !!diff };
}

/**
 * Schalter „Nur Unterschiede“, „Konzepte mit Konflikt ausblenden“ und Sortierung.
 * @param {{ setView: <K extends keyof TabPrefs>(key: K, value: TabPrefs[K]) => void }} props
 */
export function CompareTools({ setView }) {
  const m = useMatrix();
  const differing = Model.differingParameters(m).size;
  const keys = /** @type {Array<keyof typeof Evaluation.RANKINGS>} */ (Object.keys(Evaluation.RANKINGS))
    .filter(k => Evaluation.RANKINGS[k].enabled(m.settings));
  /** Sortierung nach eigenen Merkmalen (je Merkmal aufsteigend und absteigend) */
  const attrKeys = m.settings.attributes.flatMap((a, i) => (Attributes.sortable(a)
    ? ['asc', 'desc'].map(dir => ({ key: `attr:${a.id}:${dir}`, label: Texts.attributes.sort(Attributes.label(a, i), /** @type {'asc' | 'desc'} */ (dir)) }))
    : []));
  const options = [
    ...['order', ...keys].map(k => ({ key: k, label: Texts.compare.sort[/** @type {keyof typeof Texts.compare.sort} */ (k)] })),
    ...attrKeys,
  ];
  const current = options.some(o => o.key === prefs.compareSort) ? prefs.compareSort : 'order';
  /** @param {Event} e */
  const checked = e => /** @type {HTMLInputElement} */ (e.currentTarget).checked;
  return (
    <>
      <label class="check compare-diff">
        <input
          type="checkbox" id="compareDiff" checked={!!prefs.compareDiff} disabled={m.concepts.length < 2}
          onChange={e => setView('compareDiff', checked(e))}
        />
        {Texts.compare.onlyDiff}
        <span class="compare-diff-count">{Texts.compare.diffCount(differing, m.parameters.length)}</span>
      </label>
      {m.concepts.some(c => c.status === 'dropped') ? (
        <label class="check compare-hide">
          <input
            type="checkbox" id="compareHideDropped" checked={!!prefs.compareHideDropped}
            onChange={e => setView('compareHideDropped', checked(e))}
          />
          {Texts.status.hideDropped}
        </label>
      ) : null}
      {m.constraints.length ? (
        <label class="check compare-hide">
          <input
            type="checkbox" id="compareHideConflicts" checked={!!prefs.compareHideConflicts}
            onChange={e => setView('compareHideConflicts', checked(e))}
          />
          {Texts.cons.hideConflicts}
        </label>
      ) : null}
      {options.length > 1 ? (
        <label class="compare-sort">
          <span>{Texts.compare.sortBy}</span>
          <select id="compareSort" value={current} onChange={e => setView('compareSort', /** @type {any} */ (/** @type {HTMLSelectElement} */ (e.currentTarget).value))}>
            {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      ) : null}
    </>
  );
}

/** Klassen einer Kennzahl-Zelle: unvollständig und/oder bester Wert. @param {any} incomplete @param {any} best */
const metricClass = (incomplete, best) => [incomplete ? 'incomplete' : '', best ? 'best' : ''].join(' ').trim() || undefined;

/**
 * Abschnitt „Eigene Merkmale“ unter den Parametern des Vergleichs: je Merkmal die Zusammenfassung je Konzept,
 * fehlende Werte mit „*“, überschrittene Grenze als Warnung.
 * @param {Matrix} m @param {ConceptFigures[]} report @param {number} span
 */
function attributeRows(m, report, span) {
  const list = m.settings.attributes;
  if (!list.length) return [];
  return [
    <tr key="attr-head" class="attr-head-row"><th scope="colgroup" colSpan={span}>{Texts.attributes.heading}</th></tr>,
    ...list.map((a, i) => (
      <tr key={`attr:${a.id}`} class="attr-row" data-attr-row={a.id}>
        <th scope="row" title={[a.description, a.source].filter(Boolean).join(' – ') || undefined}>
          {Texts.attributes.compareRow(Attributes.label(a, i), Attributes.aggregateLabel(a))}
        </th>
        {report.map(({ concept }) => {
          const sum = Attributes.summarize(m, a, concept);
          // Bei Listen und Ja/Nein ist das Fehlen schon im Text sichtbar
          const star = sum.missing > 0 && sum.text && a.type !== 'text' && a.type !== 'bool' && a.aggregate !== 'none';
          return (
            <td
              key={concept.id} data-dropped={concept.status === 'dropped' || undefined}
              class={[sum.text ? '' : 'none', star ? 'incomplete' : '', sum.warn ? 'attr-warn-cell' : ''].join(' ').trim() || undefined}
              title={star ? Texts.attributes.missing(sum.missing) : undefined}
            >
              {sum.text ? sum.text + (star ? ' *' : '') : '–'}
              {sum.warn ? <span class="attr-warn" title={Texts.attributes.warnTitle(Attributes.limitText(a))}>{`⚠ ${Attributes.limitText(a)}`}</span> : null}
            </td>
          );
        })}
      </tr>
    )),
  ];
}

/** Konzeptvergleich als Tabelle: Parameter als Zeilen, Konzepte als Spalten, Kennzahlen im Fuß. */
export function CompareTable() {
  const m = useMatrix();
  const { ranked, groups } = compareContent();
  const showCats = m.categories.length > 0;
  const span = ranked.length + 1;
  const rows = groups.flatMap(g => [
    showCats && g.items.length ? (
      <tr key={`cat:${g.cat ? g.cat.id : ''}`} class="cat-row" style={{ '--k': categoryColor(g.cat) }}>
        <th scope="colgroup" colSpan={span}>{Model.categoryLabel(g.cat)}</th>
      </tr>
    ) : null,
    ...g.items.map(({ p, pi }) => (
      <tr key={p.id}>
        <th scope="row">{Model.parameterLabel(p, pi)}</th>
        {ranked.map(({ figures: { concept: c } }) => {
          const text = Model.optionText(p, c.selections[p.id]);
          const o = Model.selectedOption(p, c);
          return (
            <td key={c.id} data-dropped={c.status === 'dropped' || undefined} class={text ? undefined : 'none'}>
              {text || '–'}
              {o && o.note ? <span class="note-ico" title={o.note} role="img" aria-label={Texts.notes.title(text || '')}><Icon name="note" /></span> : null}
            </td>
          );
        })}
      </tr>
    )),
  ]).filter(Boolean);
  const report = ranked.map(x => x.figures);
  /**
   * Eine Kennzahl-Zeile, falls die Bewertung aktiv ist (dann ist die jeweilige Kennzahl gesetzt).
   * @param {string} key @param {any} th @param {boolean} active @param {(r: ConceptFigures) => any} cellOf
   */
  const row = (key, th, active, cellOf) => (active ? <tr key={key}>{th}{report.map(cellOf)}</tr> : null);
  const footRows = [
    row('prio', <th scope="row" title={Texts.moscow.profileTitle}>{Texts.compare.priority}</th>, m.settings.moscow, ({ concept, priority }) => priority && (
      <td key={concept.id} data-dropped={concept.status === 'dropped' || undefined}>
        <PriorityProfile counts={priority} />
        {priority.wont ? <small class="prio-note">{Texts.moscow.wontNote(priority.wont)}</small> : null}
      </td>
    )),
    row('cost', <th scope="row">{Texts.compare.totalCost}</th>, m.settings.costs, ({ concept, cost }) => cost && (
      <td key={concept.id} data-dropped={concept.status === 'dropped' || undefined} class={metricClass(cost.missing, cost.best)} title={cost.missing ? missingNote(cost.missing) : undefined}>
        {money(cost.total) + (cost.missing ? ' *' : '')}
      </td>
    )),
    row('utility', <th scope="row">{Texts.compare.utility(m.settings.utilityMax)}</th>, m.settings.utility, ({ concept, utility }) => utility && (
      <td key={concept.id} data-dropped={concept.status === 'dropped' || undefined} class={metricClass(utility.missing, utility.best)} title={utility.missing ? missingNote(utility.missing) : undefined}>
        {utility.value == null ? '–' : Util.formatNumber(utility.value) + (utility.missing ? ' *' : '')}
      </td>
    )),
    row('value', (
      <th scope="row" title={Texts.compare.priceValueTitle}>
        {Texts.compare.priceValue}<small class="th-note">{Texts.compare.priceValueNote}</small>
      </th>
    ), m.settings.costs && m.settings.utility, ({ concept, priceValue }) => priceValue && (
      <td key={concept.id} data-dropped={concept.status === 'dropped' || undefined} class={priceValue.value == null ? 'incomplete' : (priceValue.best ? 'best' : undefined)} title={priceValue.reason ?? undefined}>
        {priceValue.value == null ? '–' : money(priceValue.value)}
      </td>
    )),
  ].filter(Boolean);
  return (
    <>
      <thead>
        <tr>
          <th scope="col">{Texts.compare.parameter}</th>
          {ranked.map(({ figures: { concept: c }, rank }) => (
            <th key={c.id} scope="col" style={{ '--c': shownColor(c.color) }} class={c.status === 'dropped' ? 'is-dropped' : undefined}>
              {rank != null ? <span class="rank" title={Texts.compare.rankTitle(rank)}>{`${rank}.`}</span> : null}
              <span class="key" aria-hidden="true" />{Model.nameOrUnnamed(c)}
              <StatusChip c={c} compact />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* Verträglichkeit je Konzept, sobald die Matrix Paare enthält */}
        {m.constraints.length ? (
          <tr class="cons-row">
            <th scope="row">{Texts.cons.compareRow}</th>
            {ranked.map(({ figures: { concept: c } }) => {
              const { excluded, conditional } = Consistency.conflicts(m, c);
              return (
                <td key={c.id} data-dropped={c.status === 'dropped' || undefined}>
                  {excluded.length
                    ? <span class="cons-pill excluded">{`⚠ ${Texts.cons.conflictCount(excluded.length)}`}</span>
                    : <span class="cons-pill ok">{`✓ ${Texts.cons.consistent}`}</span>}
                  {conditional.length ? <span class="cons-pill conditional">{`! ${Texts.cons.conditionalCount(conditional.length)}`}</span> : null}
                  {[...excluded, ...conditional].map(x => <small key={Consistency.key(x.a, x.b)} class="cons-pair" title={x.note || undefined}>{pairLabel(x)}</small>)}
                </td>
              );
            })}
          </tr>
        ) : null}
        {/* Begründungen der Konzepte, sobald eines eine hat */}
        {ranked.some(({ figures: { concept: c } }) => c.note.trim()) ? (
          <tr class="note-row">
            <th scope="row">{Texts.compare.conceptNote}</th>
            {ranked.map(({ figures: { concept: c } }) => <td key={c.id} data-dropped={c.status === 'dropped' || undefined} class={c.note.trim() ? undefined : 'none'}>{c.note.trim() || '–'}</td>)}
          </tr>
        ) : null}
        {rows.length ? rows : <tr><td class="none" colSpan={span}>{Texts.compare.noDifferences}</td></tr>}
        {/* Eigene Merkmale nach den Parametern; die Kennzahlen der Bewertung stehen im Fuß */}
        {attributeRows(m, report, span)}
      </tbody>
      {footRows.length ? <tfoot>{footRows}</tfoot> : null}
    </>
  );
}

/** Komponenten in ihre Container in index.html einhängen. */
export function initPanels() {
  mount(<Stats />, $('#stats'));
  mount(<ConceptList />, $('#conceptList'));
  mount(<Summary />, $('#conceptSummary'));
}
