/*
 * Dialog „Lösungsraum“: alle widerspruchsfreien Kombinationen als Liste – mit Festlegungen
 * (auch per Klick auf eine Zelle), Filtern und Sortierung; eine Zeile lässt sich als Konzept
 * übernehmen. Gesucht wird im Web Worker (js/solutions-worker.js, Logik in js/solutions.js).
 */
import { signal } from '@preact/signals';
import { render as mount } from 'preact';
import { Attributes } from '../attributes.js';
import { Evaluation } from '../evaluation.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Solutions } from '../solutions.js';
import { Texts } from '../texts.js';
import { activeConcept, money, mutate, prefs, setMode, state, useMatrix } from './core.js';
import { consistentCount } from './count.js';
import { $, closeDialog, openDialog, toast } from './dom.jsx';
import { Util } from '../util.js';

/** Treffer je Seite („Weitere … laden“). */
const PAGE = 50;

/** Dialog geöffnet (nur dann wird gesucht). */
const open = signal(false);
/** Festlegungen, Filter und Sortierung. @type {import('@preact/signals').Signal<import('../solutions.js').SolutionQuery>} */
const query = signal({ fixed: {}, limits: false, strict: false, maxCost: null, minUtility: null, sort: 'order', limit: PAGE });
/** Letztes Ergebnis samt Signatur der Anfrage. */
const known = signal(/** @type {{ sig: string, result: import('../solutions.js').SolutionResult | null }} */ ({ sig: '', result: null }));
let asked = { sig: '', id: 0 };
/** @type {Worker | null} */
let worker = null;

/** @param {Partial<import('../solutions.js').SolutionQuery>} change */
function setQuery(change) {
  // Neue Filter: wieder mit der ersten Seite beginnen
  query.value = { ...query.value, limit: PAGE, ...change };
}

function startWorker() {
  if (worker || typeof Worker !== 'function') return worker;
  try {
    worker = new Worker(new URL('../solutions-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (/** @type {MessageEvent<{ id: number, result: import('../solutions.js').SolutionResult }>} */ e) => {
      if (e.data.id === asked.id) known.value = { sig: asked.sig, result: e.data.result };
    };
  } catch (e) {
    worker = null;
  }
  return worker;
}

/**
 * Was die Suche braucht (ohne Texte, Notizen und Konzepte) – auch als Signatur der Anfrage.
 * @param {Matrix} m
 */
function searchMatrix(m) {
  return {
    settings: m.settings,
    parameters: m.parameters.map(p => ({ id: p.id, weight: p.weight, options: p.options.map(o => ({ id: o.id, cost: o.cost, score: o.score, values: o.values })) })),
    constraints: m.constraints.map(c => ({ a: c.a, b: c.b, type: c.type })),
  };
}

/**
 * Ergebnis zur aktuellen Anfrage: bekannt, sonst beim Worker angefragt (ohne Worker direkt).
 * @param {Matrix} m @param {import('../solutions.js').SolutionQuery} q
 */
function result(m, q) {
  const matrix = searchMatrix(m);
  const sig = JSON.stringify([matrix, q]);
  const last = known.value;
  if (sig === last.sig) return { result: last.result, pending: false };
  const w = startWorker();
  if (!w) {
    const r = Solutions.search(/** @type {Matrix} */ (/** @type {unknown} */ (matrix)), q);
    known.value = { sig, result: r };
    return { result: r, pending: false };
  }
  if (sig !== asked.sig) {
    asked = { sig, id: asked.id + 1 };
    w.postMessage({ id: asked.id, matrix, query: q });
  }
  return { result: last.result, pending: true };
}

/** Festlegungen, die es in der Matrix (noch) gibt. @param {Matrix} m @param {Record<string, string>} fixed */
const validFixed = (m, fixed) => Object.fromEntries(Object.entries(fixed).filter(([pid, oid]) => {
  const p = m.parameters.find(x => x.id === pid);
  return !!p && p.options.some(o => o.id === oid);
}));

/** Ausprägung festlegen bzw. (erneut gewählt) wieder lösen. @param {string} pid @param {string} oid */
function toggleFixed(pid, oid) {
  const fixed = { ...query.value.fixed };
  if (fixed[pid] === oid) delete fixed[pid];
  else fixed[pid] = oid;
  setQuery({ fixed });
}

/** Kombination als neues Konzept übernehmen (aktiv, Modus „Kombinieren“). @param {Record<string, string>} selections */
function takeOver(selections) {
  const n = state.concepts.length + 1;
  const c = { ...Model.newConcept(state, Texts.solutions.conceptName(n)), selections: { ...selections } };
  mutate(m => Ops.addConcept(m, c));
  if (prefs.mode !== 'select') setMode('select');
  toast(Texts.solutions.taken(c.name), true);
}

/** Zahl für ein Filterfeld lesen (leer = kein Filter). @param {string} text */
function filterNumber(text) {
  const n = Util.parseNumber(text);
  return n == null || Number.isNaN(n) ? null : n;
}

export function openSolutions() {
  open.value = true;
  openDialog($('#solutionsDialog'));
}

function SolutionsView() {
  const m = useMatrix();
  if (!open.value) return null;
  const s = m.settings;
  const q = { ...query.value, fixed: validFixed(m, query.value.fixed) };
  const { result: r, pending } = result(m, q);
  const P = m.parameters;
  const attrs = s.attributes.filter(a => a.type !== 'text');
  const withLimits = s.attributes.filter(a => a.limit);
  const hasConditional = m.constraints.some(c => c.type === 'conditional');
  const active = activeConcept();
  const fixedCount = Object.keys(q.fixed).length;
  // Sortierung wie im Konzeptvergleich (nur aktive Kennzahlen und sortierbare Merkmale)
  const rankKeys = /** @type {Array<keyof typeof Evaluation.RANKINGS>} */ (Object.keys(Evaluation.RANKINGS)).filter(k => Evaluation.RANKINGS[k].enabled(s));
  const sortOptions = [
    ...['order', ...rankKeys].map(k => ({ key: k, label: Texts.compare.sort[/** @type {keyof typeof Texts.compare.sort} */ (k)] })),
    ...s.attributes.flatMap((a, i) => (Attributes.sortable(a)
      ? ['asc', 'desc'].map(dir => ({ key: `attr:${a.id}:${dir}`, label: Texts.attributes.sort(Attributes.label(a, i), /** @type {'asc' | 'desc'} */ (dir)) }))
      : [])),
  ];
  const sort = sortOptions.some(o => o.key === q.sort) ? q.sort : 'order';
  const total = consistentCount(m).value;
  const rows = r ? r.rows : [];
  const conceptByKey = new Map(m.concepts.map(c => [P.map(p => c.selections[p.id] || '').join('|'), c]));
  const fmt = (/** @type {number} */ n) => Util.formatInteger(n);
  return (
    <>
      <p class="dialog-hint">{Texts.solutions.hint}</p>
      <div class="ls-bar">
        <span class="ls-lbl">{Texts.solutions.fixed}</span>
        {fixedCount ? P.filter(p => q.fixed[p.id]).map(p => {
          const pi = P.indexOf(p);
          const text = /** @type {string} */ (Model.optionText(p, q.fixed[p.id]));
          return (
            <span key={p.id} class="ls-chip" data-fixed={p.id}>
              {`${Model.parameterLabel(p, pi)}: `}<b>{text}</b>
              <button type="button" aria-label={Texts.solutions.unfix(Model.parameterLabel(p, pi), text)} title={Texts.solutions.unfix(Model.parameterLabel(p, pi), text)} onClick={() => toggleFixed(p.id, q.fixed[p.id])}>×</button>
            </span>
          );
        }) : <span class="ls-lbl">{Texts.solutions.none}</span>}
        <select
          class="ls-pick" id="lsFixPick" value="" aria-label={Texts.solutions.fixPick}
          onChange={e => {
            const v = /** @type {HTMLSelectElement} */ (e.currentTarget).value;
            if (!v) return;
            const [pid, oid] = v.split('\n');
            setQuery({ fixed: { ...q.fixed, [pid]: oid } });
          }}
        >
          <option value="">{Texts.solutions.fixPick}</option>
          {P.map((p, pi) => (
            <optgroup key={p.id} label={Model.parameterLabel(p, pi)}>
              {p.options.map(o => <option key={o.id} value={`${p.id}\n${o.id}`}>{Model.optionText(p, o.id)}</option>)}
            </optgroup>
          ))}
        </select>
        {active && Object.keys(active.selections).length ? (
          <button type="button" class="ls-add" id="lsFromConcept" onClick={() => setQuery({ fixed: { ...active.selections } })}>
            {Texts.solutions.fromConcept(Model.nameOrUnnamed(active))}
          </button>
        ) : null}
      </div>
      <div class="ls-bar">
        {withLimits.length ? (
          <label class="check">
            <input type="checkbox" id="lsLimits" checked={q.limits} onChange={e => setQuery({ limits: /** @type {HTMLInputElement} */ (e.currentTarget).checked })} />
            {Texts.solutions.limits}
            <span class="ls-lbl">{`(${withLimits.map(a => `${Attributes.label(a, s.attributes.indexOf(a))} ${Attributes.limitText(a)}`).join(', ')})`}</span>
          </label>
        ) : null}
        {hasConditional ? (
          <label class="check">
            <input type="checkbox" id="lsStrict" checked={q.strict} onChange={e => setQuery({ strict: /** @type {HTMLInputElement} */ (e.currentTarget).checked })} />
            {Texts.solutions.strict}
          </label>
        ) : null}
        {s.costs ? (
          <label class="ls-num">
            <span class="ls-lbl">{Texts.solutions.maxCost}</span>
            <input
              type="text" inputMode="decimal" id="lsMaxCost" placeholder="–" value={Util.numberToInput(q.maxCost)}
              onChange={e => setQuery({ maxCost: filterNumber(/** @type {HTMLInputElement} */ (e.currentTarget).value) })}
            />
            <span class="ls-lbl">{Util.currencySymbol(s.currency)}</span>
          </label>
        ) : null}
        {s.utility ? (
          <label class="ls-num">
            <span class="ls-lbl">{Texts.solutions.minUtility}</span>
            <input
              type="text" inputMode="decimal" id="lsMinUtility" placeholder="–" value={Util.numberToInput(q.minUtility)}
              onChange={e => setQuery({ minUtility: filterNumber(/** @type {HTMLInputElement} */ (e.currentTarget).value) })}
            />
          </label>
        ) : null}
      </div>
      <div class="ls-count">
        <span id="lsCount" aria-live="polite">
          {!r ? Texts.solutions.pending
            : r.matched != null ? <><b>{fmt(r.matched)}</b>{` ${Texts.solutions.count(r.matched === 1, fixedCount > 0)}`}</>
              : <b>{sort === 'order' ? Texts.solutions.countBigOrder(Solutions.BIG_LIMIT) : Texts.solutions.countBig(Solutions.BIG_LIMIT)}</b>}
          {total ? ` · ${Texts.solutions.total(Util.formatInteger(total))}` : ''}
          {pending && r ? <span class="ls-pending">{` · ${Texts.solutions.pending}`}</span> : null}
        </span>
        <label class="ls-sort">
          <span class="ls-lbl">{Texts.solutions.sortBy}</span>
          <select id="lsSort" value={sort} onChange={e => setQuery({ sort: /** @type {HTMLSelectElement} */ (e.currentTarget).value })}>
            {sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      </div>
      {r && !r.complete ? <p class="ls-warn">{Texts.solutions.incomplete}</p> : null}
      <div class="ls-wrap" aria-busy={pending || undefined}>
        <table class="ls-table" id="lsTable">
          <thead>
            <tr>
              <th scope="col">#</th>
              {P.map((p, pi) => {
                const k = Model.categoryById(m, p.categoryId);
                return <th key={p.id} scope="col"><span class="ls-cat" style={{ background: k ? k.color : 'transparent' }} />{Model.parameterLabel(p, pi)}</th>;
              })}
              {s.costs ? <th scope="col" class={`num${sort === 'cost' ? ' sorted' : ''}`}>{Texts.solutions.cost}</th> : null}
              {s.utility ? <th scope="col" class={`num${sort === 'utility' ? ' sorted' : ''}`}>{Texts.solutions.utility}</th> : null}
              {s.costs && s.utility ? <th scope="col" class={`num${sort === 'priceValue' ? ' sorted' : ''}`}>{Texts.compare.priceValue}</th> : null}
              {attrs.map(a => (
                <th key={a.id} scope="col" class={`num${sort.startsWith(`attr:${a.id}:`) ? ' sorted' : ''}`}>{Attributes.label(a, s.attributes.indexOf(a))}</th>
              ))}
              <th scope="col"><span class="visually-hidden">{Texts.solutions.take}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const prev = rows[i - 1];
              const concept = conceptByKey.get(P.map(p => row.selections[p.id]).join('|'));
              const c = { selections: row.selections };
              return (
                <tr key={P.map(p => row.selections[p.id]).join('|')} data-row={i}>
                  <td class="rank">{`${i + 1}.`}</td>
                  {P.map(p => {
                    const oid = row.selections[p.id];
                    const text = /** @type {string} */ (Model.optionText(p, oid));
                    const isFixed = q.fixed[p.id] === oid;
                    return (
                      <td key={p.id} class={`ls-cell${prev && prev.selections[p.id] === oid ? ' same' : ''}${isFixed ? ' is-fixed' : ''}`}>
                        <button
                          type="button" data-fix={`${p.id}:${oid}`} title={Texts.solutions.fixCell(Model.parameterLabel(p, P.indexOf(p)), text)}
                          aria-pressed={isFixed} onClick={() => toggleFixed(p.id, oid)}
                        >{text}</button>
                      </td>
                    );
                  })}
                  {s.costs ? <td class="num">{money(row.cost) + (row.costMissing ? ' *' : '')}</td> : null}
                  {s.utility ? <td class="num"><b>{row.utility == null ? '–' : Util.formatNumber(row.utility) + (row.utilityMissing ? ' *' : '')}</b></td> : null}
                  {s.costs && s.utility ? <td class="num">{row.priceValue == null ? '–' : money(row.priceValue)}</td> : null}
                  {attrs.map(a => {
                    const sum = Attributes.summarize(m, a, /** @type {MatrixConcept} */ (/** @type {unknown} */ (c)));
                    return (
                      <td key={a.id} class={`num${sum.warn ? ' ls-warn-cell' : ''}`} title={sum.warn ? Texts.attributes.warnTitle(Attributes.limitText(a)) : undefined}>
                        {sum.text || '–'}{sum.warn ? ' ⚠' : ''}
                      </td>
                    );
                  })}
                  <td class="act">
                    {concept ? (
                      <span class="ls-exists" style={{ '--c': concept.color }} title={Texts.solutions.exists(Model.nameOrUnnamed(concept))}>
                        <i aria-hidden="true" />{Model.nameOrUnnamed(concept)}
                      </span>
                    ) : (
                      <button type="button" class="ls-take" aria-label={Texts.solutions.takeLabel(i + 1)} onClick={() => takeOver(row.selections)}>{Texts.solutions.take}</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {r && !rows.length ? <p class="ls-empty">{Texts.solutions.empty}</p> : null}
      </div>
      <div class="ls-foot">
        <span>
          {rows.length ? Texts.solutions.shown(1, fmt(rows.length), r && r.matched != null ? fmt(r.matched) : null) : ''}
          {rows.length > 1 ? ` · ${Texts.solutions.same}` : ''}
        </span>
        <span class="export-actions">
          {r && rows.length >= q.limit && (r.matched == null ? q.limit < Solutions.BIG_LIMIT : r.matched > rows.length) ? (
            <button type="button" class="btn" id="lsMore" onClick={() => { query.value = { ...query.value, limit: query.value.limit + PAGE }; }}>{Texts.solutions.more(PAGE)}</button>
          ) : null}
          <button type="button" class="btn btn-primary" id="lsDone" onClick={() => closeDialog($('#solutionsDialog'))}>{Texts.ui.done}</button>
        </span>
      </div>
    </>
  );
}

export function initSolutions() {
  mount(<SolutionsView />, $('#solutionsBody'));
  const dialog = $('#solutionsDialog');
  dialog.addEventListener('close', () => { open.value = false; });
  $('#solutionsClose').addEventListener('click', () => closeDialog(dialog));
}
