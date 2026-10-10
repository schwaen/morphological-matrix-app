/*
 * Eigene Merkmale: Definition in „Bewertung & Merkmale“, Eingabe an der Ausprägung (bis zu zwei
 * Merkmale direkt in der Zelle, ab drei als Knopf mit Popover) und die Tabelle aller Ausprägungen. Logik (Prüfung, Zusammenfassung, Grenzen) in js/attributes.js.
 */
import { signal } from '@preact/signals';
import { Fragment, render as mount } from 'preact';
import { Attributes } from '../attributes.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Icon, IconButton } from './components.jsx';
import { fieldProps, mutate, prefs, state, useMatrix } from './core.js';
import { $, closeDialog, openDialog, placeNear } from './dom.jsx';
import { NumberField, selectField } from './fields.jsx';

/** Ab so vielen Merkmalen erfasst man sie im Popover statt direkt in der Zelle. */
const INLINE_MAX = 2;

/** Merkmal, dessen Formular in den Einstellungen offen ist. */
const editing = signal(/** @type {string | null} */ (null));
/** Ausprägung, deren Popover offen ist. */
const attrFor = signal(/** @type {string | null} */ (null));
/** Bis zu diesem Zeitpunkt löst Bildlauf kein Schließen aus (eigenes Weiterblättern scrollt). */
let keepOpenUntil = 0;
/** Tabelle geöffnet (nur dann wird sie gezeichnet). */
const tableOpen = signal(false);

/** Ob Merkmale im Popover erfasst werden. @param {Matrix} m */
export const attributesInPopover = m => m.settings.attributes.length > INLINE_MAX;

/** Wert setzen bzw. (`undefined`) entfernen. @param {MatrixOption} o @param {MatrixAttribute} a @param {AttributeValue | undefined} v */
function setValue(o, a, v) {
  if (v === undefined) delete o.values[a.id];
  else o.values[a.id] = v;
}

/** Wie viele Ausprägungen einen Wert für das Merkmal haben. @param {Matrix} m @param {(v: AttributeValue) => boolean} [test] @param {string} aid */
const valueCount = (m, aid, test = () => true) => m.parameters.reduce((n, p) => n + p.options.filter(o => o.values[aid] !== undefined && test(o.values[aid])).length, 0);

// ---------- Eingabe eines Werts ----------

/**
 * Eingabe passend zur Form: Zahlenfeld, Auswahl der Stufen, Ja/Nein oder Text. Enter verlässt das
 * Feld, außer `onKeyDown` behandelt die Taste selbst.
 * @param {{ a: MatrixAttribute, o: MatrixOption, label: string, onKeyDown?: (e: KeyboardEvent) => void, [attr: string]: any }} props
 */
export function AttributeInput({ a, o, label, onKeyDown, ...attrs }) {
  const v = o.values[a.id];
  if (Attributes.isNumeric(a.type)) {
    return (
      <NumberField
        value={typeof v === 'number' ? v : null} placeholder={a.unit.trim() || '–'} label={label}
        apply={n => setValue(o, a, n ?? undefined)} validate={a.type === 'int' ? Number.isInteger : undefined}
        onKeyDown={onKeyDown} title={Attributes.isInvalid(a, v) ? Texts.attributes.invalidInt : label} {...attrs}
      />
    );
  }
  /** Enter verlässt das Feld (wie beim Zahlenfeld). @param {KeyboardEvent} e */
  const keys = e => {
    if (onKeyDown) onKeyDown(e);
    if (!e.defaultPrevented && e.key === 'Enter') { e.preventDefault(); /** @type {HTMLElement} */ (e.currentTarget).blur(); }
  };
  if (a.type === 'text') {
    return (
      <input
        type="text" class="attr-text" value={typeof v === 'string' ? v : ''} placeholder="–" aria-label={label} title={label}
        {...attrs} {...fieldProps(s => setValue(o, a, s.trim() ? s : undefined))} onKeyDown={keys}
      />
    );
  }
  const choices = a.type === 'bool'
    ? [['true', Texts.attributes.yes], ['false', Texts.attributes.no]]
    : a.levels.map(l => [l.id, Attributes.levelLabel(a, l.id)]);
  return (
    <select
      class="attr-select" value={v === undefined ? '' : String(v)} aria-label={label} title={label} {...attrs}
      {...fieldProps(s => setValue(o, a, s === '' ? undefined : (a.type === 'bool' ? s === 'true' : s)))} onKeyDown={keys}
    >
      <option value="">{Texts.attributes.unset}</option>
      {choices.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </select>
  );
}

/**
 * Merkmale einer Ausprägung im Bearbeiten-Modus: bis zu zwei als Felder, sonst als Knopf.
 * @param {{ o: MatrixOption, optLabel: string }} props
 */
export function OptionAttributes({ o, optLabel }) {
  const list = state.settings.attributes;
  if (!list.length) return null;
  if (attributesInPopover(state)) {
    return <div class="opt-attrs"><AttributeButton o={o} optLabel={optLabel} /></div>;
  }
  return (
    <div class="opt-attrs">
      {list.map((a, i) => (
        <label key={a.id} class="attr-field">
          <span class="attr-name" title={a.description || undefined}>{Attributes.label(a, i)}</span>
          <AttributeInput a={a} o={o} label={Texts.attributes.valueLabel(Attributes.label(a, i), optLabel)} />
        </label>
      ))}
    </div>
  );
}

// ---------- Knopf und Popover an der Ausprägung ----------

/** Werte als Knopf („0,6 kg · 42 dB“, erfasst „3/4“); öffnet das Popover. @param {{ o: MatrixOption, optLabel: string }} props */
function AttributeButton({ o, optLabel }) {
  const list = state.settings.attributes;
  const text = Attributes.shortText(list, o);
  const filled = list.filter(a => o.values[a.id] !== undefined).length;
  return (
    <button
      type="button" class={`score-btn attr-btn${attrFor.value === o.id ? ' is-open' : ''}`} data-attr-btn={o.id} aria-haspopup="dialog"
      aria-label={Texts.attributes.button(optLabel, text || Texts.attributes.filled(filled, list.length))}
      onClick={e => (attrFor.value === o.id ? closeAttrPop() : openAttrPop(o.id, /** @type {HTMLElement} */ (e.currentTarget)))}
    >
      <span class="metric-unit" aria-hidden="true">≡</span>
      {text ? <b>{text}</b> : <span class="score-empty">{Texts.attributes.buttonEmpty}</span>}
      <span class={`attr-filled${filled < list.length ? ' is-partial' : ''}`}>{Texts.attributes.filled(filled, list.length)}</span>
      <svg class="score-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

/** @param {string} oid @param {HTMLElement} anchor */
function openAttrPop(oid, anchor) {
  attrFor.value = oid;
  const pop = $('#attrPop');
  pop.hidden = false;
  placeNear(pop, anchor, { gap: 6 });
  selectField(/** @type {HTMLElement | null} */ (pop.querySelector('[data-attr-field="0"]')));
}

/** Zur vorigen/nächsten Ausprägung wechseln (Popover bleibt offen). @param {string} oid */
function moveAttrPop(oid) {
  const btn = /** @type {HTMLElement | null} */ (document.querySelector(`[data-attr-btn="${CSS.escape(oid)}"]`));
  if (btn) {
    keepOpenUntil = performance.now() + 300;
    btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    openAttrPop(oid, btn);
  } else {
    attrFor.value = oid;
    selectField(/** @type {HTMLElement | null} */ ($('#attrPop').querySelector('[data-attr-field="0"]')));
  }
}

function closeAttrPop(refocus = true) {
  const oid = attrFor.value;
  if (oid == null) return;
  attrFor.value = null;
  $('#attrPop').hidden = true;
  if (refocus) /** @type {HTMLElement | null} */ (document.querySelector(`[data-attr-btn="${CSS.escape(oid)}"]`))?.focus();
}

function AttributePop() {
  const m = useMatrix();
  const oid = attrFor.value;
  const ref = oid ? Model.findOption(m, oid) : null;
  if (!oid || !ref || prefs.mode !== 'edit' || !attributesInPopover(m)) {
    if (oid != null) queueMicrotask(() => closeAttrPop(false));
    return null;
  }
  const { p, pi, o, oi } = ref;
  const label = o.text.trim() || Texts.fallback.emptyOption(oi + 1);
  const all = m.parameters.flatMap(x => x.options);
  const idx = all.indexOf(o);
  /** Enter springt zum nächsten Merkmal, nach dem letzten zur nächsten Ausprägung. @param {KeyboardEvent} e */
  const onKey = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const i = Number(/** @type {HTMLElement} */ (e.currentTarget).dataset.attrField);
    const nextField = /** @type {HTMLElement | null} */ ($('#attrPop').querySelector(`[data-attr-field="${i + 1}"]`));
    if (nextField) selectField(nextField);
    else if (all[idx + 1]) moveAttrPop(all[idx + 1].id);
  };
  return (
    <>
      <div class="score-pop-head">
        <div>
          <h3 id="attrPopTitle">{Texts.attributes.popTitle(label)}</h3>
          <p>{Model.parameterLabel(p, pi)}</p>
        </div>
        <IconButton icon="x" label={Texts.ui.close} onClick={() => closeAttrPop()} />
      </div>
      <div class="score-rows attr-rows">
        {m.settings.attributes.map((a, i) => (
          <label key={a.id} class="score-row attr-row">
            <span title={a.description || undefined}>{Attributes.label(a, i)}</span>
            <AttributeInput
              key={`${o.id}:${a.id}`} a={a} o={o} label={Texts.attributes.valueLabel(Attributes.label(a, i), label)}
              data-attr-field={i} onKeyDown={onKey}
            />
          </label>
        ))}
      </div>
      <div class="score-foot">
        <span class="score-nav">
          <IconButton icon="left" label={Texts.attributes.prev} disabled={idx <= 0} onClick={() => moveAttrPop(all[idx - 1].id)} />
          <IconButton icon="right" label={Texts.attributes.next} disabled={idx >= all.length - 1} onClick={() => moveAttrPop(all[idx + 1].id)} />
        </span>
        <button type="button" class="btn btn-small" onClick={() => { closeAttrPop(false); openAttributeTable(); }}>{Texts.attributes.table}</button>
      </div>
    </>
  );
}

// ---------- Tabelle aller Ausprägungen ----------

/** Tabelle öffnen und das erste Feld fokussieren. */
export function openAttributeTable() {
  tableOpen.value = true;
  openDialog($('#attrDialog'));
  selectField(/** @type {HTMLElement | null} */ ($('#attrDialog').querySelector('[data-r="0"][data-c="0"]')));
}

/** Enter bzw. ↓/↑ springen in derselben Spalte zur nächsten bzw. vorigen Zeile. @param {KeyboardEvent} e */
function tableKey(e) {
  const el = /** @type {HTMLElement} */ (e.currentTarget);
  let delta = 0;
  // In Auswahllisten wechseln ↓/↑ den Wert
  const arrows = el.tagName !== 'SELECT';
  if ((arrows && e.key === 'ArrowDown') || (e.key === 'Enter' && !e.shiftKey)) delta = 1;
  else if ((arrows && e.key === 'ArrowUp') || (e.key === 'Enter' && e.shiftKey)) delta = -1;
  if (!delta) return;
  e.preventDefault();
  selectField(/** @type {HTMLElement | null} */ ($('#attrDialog').querySelector(`[data-r="${Number(el.dataset.r) + delta}"][data-c="${el.dataset.c}"]`)));
}

/** Werte aller Ausprägungen je Merkmal. */
function AttributeTable() {
  const m = useMatrix();
  const list = m.settings.attributes;
  if (!tableOpen.value) return null;
  if (!list.length) {
    queueMicrotask(() => closeDialog($('#attrDialog')));
    return null;
  }
  let row = 0;
  return (
    <>
      <p class="dialog-hint">{Texts.attributes.tableHint}</p>
      <div class="score-table-wrap">
        <table class="score-table attr-table">
          <thead>
            <tr>
              <th scope="col">{Texts.attributes.option}</th>
              {list.map((a, i) => (
                <th key={a.id} scope="col" title={a.description || undefined}>
                  {Attributes.label(a, i)}<small>{a.unit.trim() || Texts.attributes.types[a.type]}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.parameters.map((p, pi) => (
              <Fragment key={p.id}>
                <tr class="score-param"><th scope="colgroup" colSpan={list.length + 1}>{Model.parameterLabel(p, pi)}</th></tr>
                {p.options.map((o, oi) => {
                  const r = row++;
                  const label = o.text.trim() || Texts.fallback.emptyOption(oi + 1);
                  return (
                    <tr key={o.id}>
                      <th scope="row">{label}</th>
                      {list.map((a, ai) => (
                        <td key={a.id} class={`score-cell attr-cell attr-${a.type}`}>
                          <AttributeInput
                            a={a} o={o} label={Texts.attributes.valueLabel(Attributes.label(a, ai), label)}
                            data-r={r} data-c={ai} onKeyDown={tableKey}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Definition (Einstellungen) ----------

function addAttribute() {
  const a = Attributes.newAttribute('int');
  mutate(m => Ops.addAttribute(m, a));
  editing.value = a.id;
  selectField(/** @type {HTMLElement | null} */ (document.querySelector(`[data-attr-name="${CSS.escape(a.id)}"]`)));
}

/** @param {MatrixAttribute} a @param {number} i */
function deleteAttribute(a, i) {
  const n = valueCount(state, a.id);
  if (n && !window.confirm(Texts.attributes.deleteConfirm(Attributes.label(a, i), n))) return;
  mutate(m => Ops.deleteAttribute(m, a.id));
}

/** @param {MatrixAttribute} a @param {number} i @param {AttributeType} type */
function changeType(a, i, type) {
  const lost = valueCount(state, a.id, v => Attributes.convertValue(a, type, v) === undefined);
  if (lost && !window.confirm(Texts.attributes.typeConfirm(Attributes.label(a, i), lost))) return;
  mutate(m => Ops.setAttributeType(m, a.id, type));
}

/** @param {MatrixAttribute} a @param {string} op */
function changeLimit(a, op) {
  mutate(() => {
    if (op === 'none') a.limit = null;
    else if (op === 'allYes') a.limit = { op: 'allYes' };
    else if (op === 'level') a.limit = a.levels.length ? { op: 'level', value: a.levels[a.levels.length - 1].id } : null;
    else if (op === 'above' || op === 'below') {
      const prev = a.limit && (a.limit.op === 'above' || a.limit.op === 'below') ? a.limit.value : 0;
      a.limit = { op, value: prev };
    }
  });
  selectField(/** @type {HTMLElement | null} */ (document.querySelector(`[data-attr-limit="${CSS.escape(a.id)}"]`)));
}

/** Eigene Merkmale in „Bewertung & Merkmale“: Liste, je Merkmal aufklappbares Formular. */
export function AttributesEditor() {
  const m = useMatrix();
  const list = m.settings.attributes;
  return (
    <div class="setting attrs-setting">
      <div class="setting-title">{Texts.attributes.heading}</div>
      <p class="setting-desc">{Texts.attributes.hint}</p>
      {list.length ? (
        <ul class="attr-list">
          {list.map((a, i) => <AttributeItem key={a.id} a={a} i={i} count={list.length} />)}
        </ul>
      ) : <p class="attr-none">{Texts.attributes.none}</p>}
      <div class="attr-foot">
        <button type="button" class="btn btn-small" id="addAttributeBtn" onClick={addAttribute}><Icon name="plus" /><span>{Texts.attributes.add}</span></button>
        {list.length ? <button type="button" class="btn btn-small" id="attrTableBtn" onClick={() => openAttributeTable()}>{Texts.attributes.table}</button> : null}
      </div>
    </div>
  );
}

/** Zusammenfassung eines Merkmals in der Liste („Dezimalzahl · je Konzept: Summe · ⚠ über 6 kg“). @param {MatrixAttribute} a */
function attributeSummary(a) {
  const type = Texts.attributes.types[a.type] + (a.unit.trim() ? ` (${a.unit.trim()})` : '');
  const text = Texts.attributes.summary(type, Attributes.aggregateLabel(a));
  return a.limit ? `${text} · ⚠ ${Attributes.limitText(a)}` : text;
}

/** @param {{ a: MatrixAttribute, i: number, count: number }} props */
function AttributeItem({ a, i, count }) {
  const open = editing.value === a.id;
  const name = Attributes.label(a, i);
  return (
    <li class={`attr-item${open ? ' is-open' : ''}`} data-attr={a.id}>
      <div class="attr-head">
        <button type="button" class="attr-title" aria-expanded={open} title={Texts.attributes.edit(name)} onClick={() => { editing.value = open ? null : a.id; }}>
          <b>{name}</b>
          <small>{attributeSummary(a)}</small>
        </button>
        <IconButton icon="up" label={Texts.attributes.moveUp} disabled={i === 0} onClick={() => mutate(m => Ops.moveAttribute(m, i, -1))} />
        <IconButton icon="down" label={Texts.attributes.moveDown} disabled={i === count - 1} onClick={() => mutate(m => Ops.moveAttribute(m, i, 1))} />
        <IconButton icon="trash" label={Texts.attributes.delete} danger onClick={() => deleteAttribute(a, i)} />
      </div>
      {open ? <AttributeForm a={a} i={i} /> : null}
    </li>
  );
}

/** Formular eines Merkmals. @param {{ a: MatrixAttribute, i: number }} props */
function AttributeForm({ a, i }) {
  /** Gewählter Wert – vor `mutate` lesen, denn dessen erstes Neuzeichnen setzt die Auswahl zurück. @param {Event} e */
  const value = e => /** @type {HTMLSelectElement} */ (e.currentTarget).value;
  const aggregates = Attributes.AGGREGATES[a.type];
  const limits = Attributes.LIMITS[a.type];
  const limit = a.limit;
  return (
    <div class="attr-form">
      <label class="attr-wide">
        <span>{Texts.attributes.name}</span>
        <input
          type="text" value={a.name} placeholder={Texts.attributes.namePlaceholder} aria-label={Texts.attributes.nameLabel(i + 1)}
          data-attr-name={a.id} {...fieldProps(v => { a.name = v; })}
        />
      </label>
      <label>
        <span>{Texts.attributes.type}</span>
        <select value={a.type} data-attr-type={a.id} onChange={e => changeType(a, i, /** @type {AttributeType} */ (value(e)))}>
          {Attributes.TYPES.map(t => <option key={t} value={t}>{Texts.attributes.types[t]}</option>)}
        </select>
      </label>
      {Attributes.isNumeric(a.type) ? (
        <label>
          <span>{Texts.attributes.unit}</span>
          <input type="text" value={a.unit} placeholder={Texts.attributes.unitPlaceholder} data-attr-unit={a.id} {...fieldProps(v => { a.unit = v; })} />
        </label>
      ) : null}
      {a.type === 'decimal' ? (
        <label>
          <span>{Texts.attributes.decimals}</span>
          <select value={String(a.decimals)} onChange={e => { const n = Number(value(e)); mutate(() => { a.decimals = n; }); }}>
            {[1, 2, 3].map(n => <option key={n} value={String(n)}>{n}</option>)}
          </select>
        </label>
      ) : null}
      {a.type === 'choice' ? <LevelEditor a={a} /> : null}
      <label>
        <span>{Texts.attributes.aggregate}</span>
        <select value={a.aggregate} disabled={aggregates.length < 2} data-attr-aggregate={a.id} onChange={e => { const g = /** @type {AttributeAggregate} */ (value(e)); mutate(() => { a.aggregate = g; }); }}>
          {aggregates.map(g => (
            <option key={g} value={g}>{Attributes.aggregateLabel({ ...a, aggregate: g })}</option>
          ))}
        </select>
      </label>
      {limits.length ? (
        <div class="attr-limit">
          <label>
            <span>{Texts.attributes.limit}</span>
            <select value={limit ? limit.op : 'none'} data-attr-limit-op={a.id} onChange={e => changeLimit(a, value(e))}>
              {['none', ...limits].map(op => <option key={op} value={op}>{Texts.attributes.limitOps[/** @type {keyof typeof Texts.attributes.limitOps} */ (op)]}</option>)}
            </select>
          </label>
          {limit && (limit.op === 'above' || limit.op === 'below') ? (
            <label class="attr-limit-value">
              <span class="visually-hidden">{Texts.attributes.limitValue}</span>
              <NumberField
                value={limit.value} label={Texts.attributes.limitValue} data-attr-limit={a.id}
                apply={n => { if (a.limit && (a.limit.op === 'above' || a.limit.op === 'below')) a.limit.value = n ?? 0; }}
              />
              {a.unit.trim() ? <small>{a.unit.trim()}</small> : null}
            </label>
          ) : null}
          {limit && limit.op === 'level' ? (
            <label class="attr-limit-value">
              <span class="visually-hidden">{Texts.attributes.limitValue}</span>
              <select value={limit.value} data-attr-limit={a.id} onChange={e => { const v = value(e); mutate(() => { a.limit = { op: 'level', value: v }; }); }}>
                {a.levels.map(l => <option key={l.id} value={l.id}>{Attributes.levelLabel(a, l.id)}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <label class="attr-wide">
        <span>{Texts.attributes.description}</span>
        <textarea class="autosize" rows={1} value={a.description} {...fieldProps(v => { a.description = v; })} />
      </label>
      <label class="attr-wide">
        <span>{Texts.attributes.source}</span>
        <input type="text" value={a.source} placeholder={Texts.attributes.sourcePlaceholder} {...fieldProps(v => { a.source = v; })} />
      </label>
      <div class="attr-wide attr-form-foot">
        <button type="button" class="btn btn-small" onClick={() => { editing.value = null; }}>{Texts.attributes.done}</button>
      </div>
    </div>
  );
}

/** Stufen eines Auswahl-Merkmals (Reihenfolge = Rangfolge). @param {{ a: MatrixAttribute }} props */
function LevelEditor({ a }) {
  const add = () => {
    const level = Attributes.newLevel();
    mutate(() => { a.levels.push(level); });
    selectField(/** @type {HTMLElement | null} */ (document.querySelector(`[data-level="${CSS.escape(level.id)}"]`)));
  };
  /** @param {AttributeLevel} l */
  const remove = l => {
    const n = valueCount(state, a.id, v => v === l.id);
    if (n && !window.confirm(Texts.attributes.deleteLevelConfirm(Attributes.levelLabel(a, l.id), n))) return;
    mutate(m => Ops.deleteLevel(m, a.id, l.id));
  };
  /** @param {number} k @param {number} delta */
  const move = (k, delta) => mutate(() => {
    const [l] = a.levels.splice(k, 1);
    a.levels.splice(k + delta, 0, l);
  });
  return (
    <div class="attr-wide attr-levels">
      <span>{Texts.attributes.levels}</span>
      <ol>
        {a.levels.map((l, k) => (
          <li key={l.id}>
            <input
              type="text" value={l.name} placeholder={Texts.fallback.level(k + 1)} aria-label={Texts.attributes.levelLabel(k + 1)}
              data-level={l.id} {...fieldProps(v => { l.name = v; })}
            />
            <IconButton icon="up" label={Texts.attributes.moveUp} disabled={k === 0} onClick={() => move(k, -1)} />
            <IconButton icon="down" label={Texts.attributes.moveDown} disabled={k === a.levels.length - 1} onClick={() => move(k, 1)} />
            <IconButton icon="trash" label={Texts.attributes.deleteLevel(Attributes.levelLabel(a, l.id))} danger disabled={a.levels.length < 2} onClick={() => remove(l)} />
          </li>
        ))}
      </ol>
      <button type="button" class="btn btn-small" data-add-level={a.id} onClick={add}><Icon name="plus" /><span>{Texts.attributes.addLevel}</span></button>
    </div>
  );
}

export function initAttributes() {
  mount(<AttributePop />, $('#attrPop'));
  mount(<AttributeTable />, $('#attrBody'));
  const dialog = $('#attrDialog');
  dialog.addEventListener('close', () => { tableOpen.value = false; });
  $('#attrClose').addEventListener('click', () => closeDialog(dialog));
  $('#attrDone').addEventListener('click', () => closeDialog(dialog));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && attrFor.value != null) { e.preventDefault(); closeAttrPop(); }
  });
  document.addEventListener('mousedown', e => {
    if (attrFor.value == null) return;
    if (!/** @type {HTMLElement} */ (e.target).closest('#attrPop, [data-attr-btn]')) closeAttrPop(false);
  });
  window.addEventListener('scroll', e => {
    if (attrFor.value == null || performance.now() < keepOpenUntil) return;
    if (!$('#attrPop').contains(/** @type {Node} */ (e.target))) closeAttrPop(false);
  }, { passive: true, capture: true });
}
