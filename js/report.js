/*
 * Report – Bericht einer Matrix als eigenständige HTML-Datei oder als Markdown (ohne DOM).
 * Reihenfolge: Kopf (Problemstellung, Kennzahlen), Lösungskonzepte, Konzeptvergleich,
 * Kosten/Nutzen-Diagramm (nur HTML), Matrix mit Notizen, Verträglichkeiten. Welche Teile
 * enthalten sind, bestimmt `ReportParts`; Texte in der aktiven Sprache.
 */
import { Consistency } from './consistency.js';
import { Evaluation } from './evaluation.js';
import { Model } from './model.js';
import { ScatterLayout } from './scatter-layout.js';
import { Texts } from './texts.js';
import { Util } from './util.js';

export const Report = (() => {
  /** @returns {ReportParts} */
  const defaultParts = () => ({
    facts: true, concepts: true, hideDropped: false, compare: true, evaluation: true, chart: true, matrix: true, constraints: true,
  });

  /** HTML-Sonderzeichen maskieren. @param {unknown} s */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  /** Text für eine Markdown-Tabellenzelle bzw. Fließtext. @param {unknown} s */
  const mdCell = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
  /** @param {unknown} s */
  const mdText = s => String(s ?? '').replace(/([\\`*_[\]#|<>])/g, '\\$1');

  /**
   * Gemeinsame Grundlage beider Formate.
   * @param {Matrix} m @param {ReportParts} parts
   */
  function prepare(m, parts) {
    const all = Evaluation.conceptReport(m);
    const rows = parts.hideDropped ? all.filter(r => r.concept.status !== 'dropped') : all;
    const evalOn = parts.evaluation;
    const s = m.settings;
    const money = (/** @type {number} */ n) => Util.formatMoney(n, s.currency);
    const hasExcluded = m.constraints.some(c => c.type === 'excluded');
    const combos = m.parameters.length ? m.parameters.reduce((n, p) => n * BigInt(p.options.length), 1n) : 0n;
    const ok = hasExcluded ? Consistency.countConsistent(m) : null;
    /** @type {Array<Exclude<ConceptStatus, 'draft'>>} */
    const statusOrder = ['chosen', 'favorite', 'dropped'];
    const statusParts = statusOrder.map(st => [st, m.concepts.filter(c => c.status === st).length])
      .filter(([, n]) => n).map(([st, n]) => Texts.status.count(/** @type {number} */ (n), /** @type {any} */ (st)));
    const optionCount = m.parameters.reduce((n, p) => n + p.options.length, 0);
    return {
      rows, hidden: all.length - rows.length, money, groups: Model.categoryGroups(m), showCats: m.categories.length > 0,
      costs: evalOn && s.costs, utility: evalOn && s.utility, moscow: evalOn && s.moscow,
      facts: [
        `${Util.formatInteger(m.parameters.length)} ${Texts.stats.parameters}`,
        `${Util.formatInteger(optionCount)} ${Texts.stats.options(optionCount)}`,
        Texts.report.combinations(Util.formatInteger(combos), ok == null ? null : Util.formatInteger(ok)),
        Texts.report.concepts(m.concepts.length, statusParts.join(', ')),
      ],
    };
  }

  /** Gewählte Ausprägung eines Konzepts als Text. @param {MatrixParameter} p @param {MatrixConcept} c */
  const choice = (p, c) => Model.optionText(p, c.selections[p.id]) || Texts.summary.notSelected;
  /** Status als Text mit Symbol. @param {ConceptStatus} st */
  const statusText = st => {
    const { icon, label } = Texts.status.levels[st];
    return icon ? `${icon} ${label}` : label;
  };
  /** Kennzahlen eines Konzepts als Textstücke. @param {ReturnType<typeof prepare>} ctx @param {ConceptFigures} f @param {Matrix} m */
  function kpis(ctx, f, m) {
    /** @type {Array<[string, string]>} */
    const out = [];
    const star = (/** @type {number} */ missing) => (missing ? ' *' : '');
    if (ctx.costs && f.cost) out.push([Texts.compare.totalCost, ctx.money(f.cost.total) + star(f.cost.missing)]);
    if (ctx.utility && f.utility) {
      out.push([Texts.summary.utility, f.utility.value == null ? '–' : Texts.summary.utilityValue(Util.formatNumber(f.utility.value), m.settings.utilityMax) + star(f.utility.missing)]);
    }
    if (ctx.costs && ctx.utility && f.priceValue) {
      out.push([Texts.compare.priceValue, f.priceValue.value == null ? '–' : `${ctx.money(f.priceValue.value)} ${Texts.report.perPoint}`]);
    }
    if (ctx.moscow && f.priority) out.push([Texts.compare.priority, priorityText(f.priority)]);
    return out;
  }
  /** @param {Record<MatrixPriority | 'none', number>} counts */
  const priorityText = counts => [
    ...Model.PRIORITIES.filter(l => counts[l]).map(l => `${counts[l]} × ${Texts.moscow.levels[l].short}`),
    ...(counts.none ? [`${counts.none} × ${Texts.moscow.none}`] : []),
  ].join(', ');
  /** Verträglichkeit eines Konzepts als Text. @param {Matrix} m @param {MatrixConcept} c */
  function consText(m, c) {
    const { excluded } = Consistency.conflicts(m, c);
    if (!excluded.length) return { ok: true, text: `✓ ${Texts.cons.consistent}` };
    const pairs = excluded.map(x => `${optionName(m, x.a)} × ${optionName(m, x.b)}`).join(', ');
    return { ok: false, text: `⚠ ${Texts.cons.conflictCount(excluded.length)}: ${pairs}` };
  }
  /** @param {Matrix} m @param {string} oid */
  const optionName = (m, oid) => {
    const r = Model.findOption(m, oid);
    return r ? (r.o.text.trim() || Texts.fallback.emptyOption(r.oi + 1)) : '?';
  };
  /**
   * Kennzahlen einer Ausprägung („18,00 € · NW 6 · M“); der Nutzwert ist bei mehreren Kriterien
   * ihr gewichtetes Mittel. @param {ReturnType<typeof prepare>} ctx @param {Matrix} m @param {MatrixOption} o
   */
  const optionMetrics = (ctx, m, o) => {
    const score = ctx.utility ? Evaluation.optionScore(m, o).value : null;
    return [
      ctx.costs && o.cost != null ? ctx.money(o.cost) : '',
      score != null ? Texts.matrix.utilityShort(Util.formatNumber(score)) : '',
      ctx.moscow && o.priority ? Texts.moscow.levels[o.priority].short : '',
    ].filter(Boolean).join(' · ');
  };
  /**
   * Zeilen „Nutzwert je Kriterium“ für den Vergleich (nur bei mehreren Kriterien).
   * @param {Matrix} m @param {ReturnType<typeof prepare>} ctx
   * @returns {Array<{ label: string, cell: (f: ConceptFigures) => { text: string, best: boolean } | null }>}
   */
  function criteriaRows(m, ctx) {
    if (!ctx.utility || m.settings.criteria.length < 2) return [];
    const per = new Map(ctx.rows.map(f => [f.concept.id, Evaluation.conceptCriteria(m, f.concept)]));
    return Evaluation.criterionShares(m).map(({ c, share }, k) => {
      const values = ctx.rows.map(f => /** @type {NonNullable<ReturnType<typeof per.get>>} */ (per.get(f.concept.id))[k].value).filter(v => v != null);
      const top = values.length > 1 ? Math.max(.../** @type {number[]} */ (values)) : null;
      return {
        label: Texts.criteria.compareRow(Model.criterionLabel(c), Util.formatPercent(share)),
        cell: f => {
          const x = /** @type {NonNullable<ReturnType<typeof per.get>>} */ (per.get(f.concept.id))[k];
          return x.value == null ? null : { text: Util.formatNumber(x.value) + (x.missing ? ' *' : ''), best: x.value === top };
        },
      };
    });
  }

  const dateText = (/** @type {Date} */ d) => new Intl.DateTimeFormat(Texts.meta.locale, { dateStyle: 'long' }).format(d);

  // ---------- HTML ----------

  const CSS = `
:root { --text:#1d2433; --muted:#5d6678; --border:#e3e6ec; --soft:#f5f6f9; --good:#2b8a3e; --bad:#c92a2a; --warn:#a35200; }
* { box-sizing: border-box; }
body { margin:0; background:#fff; color:var(--text); font:15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 900px; margin: 0 auto; padding: 36px 24px 60px; }
h1 { font-size:1.7rem; margin:0; letter-spacing:-.01em; }
h2 { font-size:1.05rem; margin:34px 0 10px; padding-bottom:6px; border-bottom:2px solid var(--text); }
h3 { font-size:.98rem; margin:0; display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; }
.meta { color:var(--muted); font-size:.82rem; margin:2px 0 0; }
.lead { font-size:1.05rem; margin:16px 0 0; white-space:pre-line; }
.facts { display:flex; flex-wrap:wrap; gap:4px 22px; margin-top:12px; color:var(--muted); font-size:.85rem; }
table { width:100%; border-collapse:collapse; font-size:.86rem; }
.wide { overflow-x:auto; }
@media print { .wide { overflow:visible; } }
th, td { text-align:left; vertical-align:top; padding:6px 8px; border-bottom:1px solid var(--border); }
thead th { font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
tr.cat th { background:var(--soft); font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; border-left:3px solid var(--k); }
.dot { display:inline-block; width:9px; height:9px; border-radius:50%; background:var(--c); margin-right:5px; vertical-align:0; flex:none; }
.note { display:block; color:var(--muted); font-style:italic; font-size:.78rem; font-weight:400; white-space:pre-line; }
.metrics { display:block; color:var(--muted); font-size:.76rem; }
.chip { display:inline-block; padding:0 8px; border-radius:999px; border:1px solid var(--border); font-size:.72rem; font-weight:700; color:var(--muted); }
.chip.favorite { color:var(--warn); background:#fff4e0; } .chip.dropped { background:var(--soft); } .chip.chosen { color:var(--good); background:#e6f7ea; }
.concept { border:1px solid var(--border); border-radius:10px; padding:14px 16px; margin:0 0 12px; break-inside:avoid; }
.concept.dropped { opacity:.72; } .concept.dropped .name { text-decoration:line-through; }
.concept .why { margin:8px 0 0; white-space:pre-line; }
.concept .status-why { color:var(--muted); font-size:.85rem; font-style:italic; margin:4px 0 0; white-space:pre-line; }
.kpis { display:flex; flex-wrap:wrap; gap:4px 18px; margin-top:10px; font-size:.85rem; }
.kpis b { font-variant-numeric:tabular-nums; }
.concept dl { display:grid; grid-template-columns:max-content 1fr; gap:2px 14px; margin:10px 0 0; font-size:.86rem; }
.concept dt { color:var(--muted); } .concept dd { margin:0; }
@media (min-width: 720px) { .concept dl.two { grid-template-columns:max-content 1fr max-content 1fr; } }
.bad { color:var(--bad); font-weight:650; } .ok { color:var(--good); font-weight:650; } .cond { color:var(--warn); font-weight:650; }
td.num { font-variant-numeric:tabular-nums; } td.best { color:var(--good); font-weight:700; }
td.none { color:var(--muted); }
.hint { color:var(--muted); font-size:.82rem; }
.chart svg { display:block; max-width:100%; height:auto; font-family:inherit; }
.chart .keys { display:flex; flex-wrap:wrap; gap:4px 18px; color:var(--muted); font-size:.78rem; margin-top:4px; }
footer { margin-top:40px; color:var(--muted); font-size:.78rem; }
@media print { main { padding:0; } h2 { break-after:avoid; } }
`;

  /**
   * Bericht als eigenständige HTML-Datei.
   * @param {Matrix} m @param {ReportParts} parts @param {{ date?: Date }} [opts]
   */
  function toHtml(m, parts, { date = new Date() } = {}) {
    const ctx = prepare(m, parts);
    const dot = (/** @type {MatrixConcept} */ c) => `<i class="dot" style="--c:${esc(c.color)}"></i>`;
    const catRow = (/** @type {MatrixCategory | null} */ cat, /** @type {number} */ span) =>
      `<tr class="cat" style="--k:${esc(cat ? cat.color : '#98a2b3')}"><th colspan="${span}">${esc(Model.categoryLabel(cat))}</th></tr>`;
    const out = [];
    out.push(`<!doctype html><html lang="${esc(Texts.meta.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`);
    out.push(`<title>${esc(m.title || Texts.fallback.unnamed)}</title><style>${CSS}</style></head><body><main>`);
    out.push(`<header><h1>${esc(m.title || Texts.fallback.unnamed)}</h1><p class="meta">${esc(Texts.report.meta(dateText(date)))}</p>`);
    if (parts.facts) {
      if (m.description.trim()) out.push(`<p class="lead">${esc(m.description)}</p>`);
      out.push(`<div class="facts">${ctx.facts.map(f => `<span>${esc(f)}</span>`).join('')}</div>`);
    }
    out.push('</header>');

    if (parts.concepts) {
      out.push(`<h2>${esc(Texts.report.sections.concepts)}</h2>`);
      if (!ctx.rows.length) out.push(`<p class="hint">${esc(Texts.report.noConcepts)}</p>`);
      for (const f of ctx.rows) {
        const c = f.concept;
        out.push(`<section class="concept${c.status === 'dropped' ? ' dropped' : ''}"><h3>${dot(c)}<span class="name">${esc(Model.nameOrUnnamed(c))}</span> <span class="chip ${c.status}">${esc(statusText(c.status))}</span></h3>`);
        if (c.statusNote.trim()) out.push(`<p class="status-why">${esc(c.statusNote)}</p>`);
        if (c.note.trim()) out.push(`<p class="why">${esc(c.note)}</p>`);
        const k = kpis(ctx, f, m);
        const cons = m.constraints.length ? consText(m, c) : null;
        if (k.length || cons) {
          out.push(`<div class="kpis">${k.map(([l, v]) => `<span>${esc(l)} <b>${esc(v)}</b></span>`).join('')}${cons ? `<span class="${cons.ok ? 'ok' : 'bad'}">${esc(cons.text)}</span>` : ''}</div>`);
        }
        // Viele Parameter: zweispaltig, damit die Karten nicht zu lang werden
        out.push(`<dl${m.parameters.length > 8 ? ' class="two"' : ''}>${m.parameters.map((p, pi) => `<dt>${esc(Model.parameterLabel(p, pi))}</dt><dd>${esc(choice(p, c))}</dd>`).join('')}</dl></section>`);
      }
      if (ctx.hidden) out.push(`<p class="hint">${esc(Texts.report.droppedHidden(ctx.hidden))}</p>`);
    }

    if (parts.compare && ctx.rows.length) {
      const span = ctx.rows.length + 1;
      out.push(`<h2>${esc(Texts.report.sections.compare)}</h2><div class="wide"><table><thead><tr><th>${esc(Texts.compare.parameter)}</th>`);
      out.push(ctx.rows.map(({ concept: c }) => `<th>${dot(c)}${esc(Model.nameOrUnnamed(c))}</th>`).join('') + '</tr></thead><tbody>');
      for (const g of ctx.groups) {
        if (!g.items.length) continue;
        if (ctx.showCats) out.push(catRow(g.cat, span));
        for (const { p, pi } of g.items) {
          out.push(`<tr><th>${esc(Model.parameterLabel(p, pi))}</th>${ctx.rows.map(({ concept: c }) => {
            const t = Model.optionText(p, c.selections[p.id]);
            return `<td${t ? '' : ' class="none"'}>${esc(t || '–')}</td>`;
          }).join('')}</tr>`);
        }
      }
      const figureRow = (/** @type {string} */ label, /** @type {(f: ConceptFigures) => { text: string, best: boolean } | null} */ cell) =>
        `<tr><th>${esc(label)}</th>${ctx.rows.map(f => { const x = cell(f); return `<td class="num${x && x.best ? ' best' : ''}">${esc(x ? x.text : '–')}</td>`; }).join('')}</tr>`;
      if (ctx.costs) out.push(figureRow(Texts.compare.totalCost, f => (f.cost ? { text: ctx.money(f.cost.total) + (f.cost.missing ? ' *' : ''), best: f.cost.best } : null)));
      if (ctx.utility) out.push(figureRow(Texts.compare.utility(m.settings.utilityMax), f => (f.utility && f.utility.value != null ? { text: Util.formatNumber(f.utility.value) + (f.utility.missing ? ' *' : ''), best: f.utility.best } : null)));
      for (const row of criteriaRows(m, ctx)) out.push(figureRow(row.label, f => row.cell(f)));
      if (ctx.costs && ctx.utility) out.push(figureRow(Texts.compare.priceValue, f => (f.priceValue && f.priceValue.value != null ? { text: ctx.money(f.priceValue.value), best: f.priceValue.best } : null)));
      if (ctx.moscow) out.push(figureRow(Texts.compare.priority, f => (f.priority ? { text: priorityText(f.priority), best: false } : null)));
      out.push('</tbody></table></div>');
    }

    if (parts.chart && m.settings.costs && m.settings.utility && ctx.rows.length) {
      const svg = chartSvg(m, ctx.rows, ctx.money);
      if (svg) out.push(`<h2>${esc(Texts.report.sections.chart)}</h2><div class="chart">${svg}<div class="keys"><span>– – ${esc(Texts.scatter.keyFront)}</span><span>○ ${esc(Texts.scatter.keyIncomplete)}</span><span>${esc(Texts.scatter.keyDominated)}</span></div></div>`);
    }

    if (parts.matrix && m.parameters.length) {
      const cols = Math.max(1, ...m.parameters.map(p => p.options.length));
      const shown = ctx.rows.map(r => r.concept);
      out.push(`<h2>${esc(Texts.report.sections.matrix)}</h2><div class="wide"><table><tbody>`);
      for (const g of ctx.groups) {
        if (!g.items.length) continue;
        if (ctx.showCats) out.push(catRow(g.cat, cols + 1));
        for (const { p, pi } of g.items) {
          const cells = p.options.map((o, oi) => {
            const by = shown.filter(c => c.selections[p.id] === o.id);
            const metrics = optionMetrics(ctx, m, o);
            return `<td${by.length ? ` title="${esc(Texts.report.chosenBy(by.map(Model.nameOrUnnamed).join(', ')))}"` : ''}>${by.map(dot).join('')}${esc(o.text.trim() || Texts.fallback.emptyOption(oi + 1))}`
              + `${metrics ? `<span class="metrics">${esc(metrics)}</span>` : ''}${o.note.trim() ? `<span class="note">${esc(o.note)}</span>` : ''}</td>`;
          });
          while (cells.length < cols) cells.push('<td></td>');
          out.push(`<tr><th>${esc(Model.parameterLabel(p, pi))}${p.note.trim() ? `<span class="note">${esc(p.note)}</span>` : ''}</th>${cells.join('')}</tr>`);
        }
      }
      out.push('</tbody></table></div>');
    }

    if (parts.constraints && m.constraints.length) {
      out.push(`<h2>${esc(Texts.report.sections.constraints)}</h2><div class="wide"><table><thead><tr><th>${esc(Texts.report.option)}</th><th>${esc(Texts.report.option)}</th><th>${esc(Texts.cons.compareRow)}</th><th>${esc(Texts.cons.noteHeading)}</th></tr></thead><tbody>`);
      for (const x of m.constraints) {
        const side = (/** @type {string} */ oid) => {
          const r = Model.findOption(m, oid);
          return r ? `${esc(optionName(m, oid))} <span class="note" style="display:inline">(${esc(Model.parameterLabel(r.p, r.pi))})</span>` : '?';
        };
        const type = x.type === 'excluded' ? `<span class="bad">✕ ${esc(Texts.cons.types.excluded)}</span>` : `<span class="cond">! ${esc(Texts.cons.types.conditional)}</span>`;
        out.push(`<tr><td>${side(x.a)}</td><td>${side(x.b)}</td><td>${type}</td><td>${esc(x.note)}</td></tr>`);
      }
      out.push('</tbody></table></div>');
    }
    out.push(`<footer>${esc(Texts.report.footer(Model.SCHEMA_VERSION))}</footer></main></body></html>`);
    return out.join('\n');
  }

  /**
   * Kosten/Nutzen-Diagramm als eingebettetes SVG (gleiche Geometrie wie in der App); `''`, wenn
   * kein Konzept Kosten und Nutzwert hat. @param {Matrix} m @param {ConceptFigures[]} rows @param {(n: number) => string} money
   */
  function chartSvg(m, rows, money) {
    const front = Evaluation.pareto(rows);
    const pts = rows.filter(r => front.has(r.concept.id)).map(r => ({ c: r.concept, f: /** @type {NonNullable<ReturnType<typeof front.get>>} */ (front.get(r.concept.id)) }));
    if (!pts.length) return '';
    const yMax = m.settings.utilityMax;
    const L = ScatterLayout.layout(pts.map(q => ({
      cost: q.f.cost, utility: q.f.utility, front: q.f.front, active: false, label: `${Model.nameOrUnnamed(q.c)}${q.f.complete ? '' : ' *'}`,
    })), { width: 820, yMax, frontLabel: Texts.scatter.front });
    const t = (/** @type {number} */ x, /** @type {number} */ y, /** @type {string} */ text, /** @type {string} */ attrs = '') => `<text x="${x}" y="${y}" ${attrs}>${esc(text)}</text>`;
    const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}" role="img" aria-label="${esc(Texts.scatter.label)}" font-size="11">`];
    o.push('<g stroke="#e3e6ec">');
    for (const v of L.xTicks) o.push(`<line x1="${L.X(v)}" x2="${L.X(v)}" y1="${L.pad.top}" y2="${L.H - L.pad.bottom}"/>`);
    for (const v of L.yTicks) o.push(`<line x1="${L.pad.left}" x2="${L.plotR}" y1="${L.Y(v)}" y2="${L.Y(v)}"/>`);
    o.push('</g>');
    if (L.hasFront) {
      o.push(`<path d="${L.frontArea}" fill="#1d2433" fill-opacity=".035"/><path d="${L.frontPath}" fill="none" stroke="#1d2433" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="5 4"/>`);
      o.push(t(L.plotR - 4, L.frontLabelY, Texts.scatter.front, 'text-anchor="end" fill="#5d6678" font-style="italic"'));
    }
    o.push('<g fill="#5d6678">');
    L.xTicks.filter((_, i) => L.xTicks.length <= 6 || i % 2 === 0).forEach(v => o.push(t(L.X(v), L.H - L.pad.bottom + 18, Util.formatMoney(v, m.settings.currency, true), 'text-anchor="middle"')));
    L.yTicks.forEach(v => o.push(t(L.pad.left - 10, L.Y(v) + 4, Util.formatNumber(v), 'text-anchor="end"')));
    o.push(t((L.pad.left + L.plotR) / 2, L.H - 6, Texts.scatter.axisCost, 'text-anchor="middle" font-weight="650"'));
    o.push(`<text transform="translate(14 ${(L.pad.top + L.H - L.pad.bottom) / 2}) rotate(-90)" text-anchor="middle" font-weight="650">${esc(Texts.scatter.axisUtility(yMax))}</text>`);
    o.push('</g>');
    pts.forEach((q, i) => {
      const x = L.X(q.f.cost);
      const y = L.Y(q.f.utility);
      const l = L.labels[i];
      const fill = q.f.complete ? esc(q.c.color) : '#fff';
      o.push(`<g opacity="${q.f.dominatedBy ? '.4' : '1'}"><title>${esc(`${Model.nameOrUnnamed(q.c)}: ${money(q.f.cost)}, ${Texts.summary.utility} ${Util.formatNumber(q.f.utility)}`)}</title>`);
      o.push(`<circle cx="${x}" cy="${y}" r="${L.dot}" fill="${fill}" stroke="${q.f.complete ? '#fff' : esc(q.c.color)}" stroke-width="${q.f.complete ? 2 : 2.5}"/>`);
      if (l) o.push(t(l.x, l.y, `${Model.nameOrUnnamed(q.c)}${q.f.complete ? '' : ' *'}`, `text-anchor="${l.anchor}" font-size="12" font-weight="600" fill="#1d2433" paint-order="stroke" stroke="#fff" stroke-width="4"`));
      o.push('</g>');
    });
    o.push('</svg>');
    return o.join('');
  }

  // ---------- Markdown ----------

  /**
   * Bericht als Markdown (GitHub-Tabellen).
   * @param {Matrix} m @param {ReportParts} parts @param {{ date?: Date }} [opts]
   */
  function toMarkdown(m, parts, { date = new Date() } = {}) {
    const ctx = prepare(m, parts);
    /** @type {string[]} */
    const out = [];
    const table = (/** @type {string[]} */ head, /** @type {string[][]} */ body) => {
      out.push(`| ${head.map(mdCell).join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`);
      for (const r of body) out.push(`| ${r.map(mdCell).join(' | ')} |`);
      out.push('');
    };
    out.push(`# ${mdText(m.title || Texts.fallback.unnamed)}`, '', `_${mdText(Texts.report.meta(dateText(date)))}_`, '');
    if (parts.facts) {
      if (m.description.trim()) out.push(mdText(m.description), '');
      out.push(ctx.facts.map(mdText).join(' · '), '');
    }
    if (parts.concepts) {
      out.push(`## ${Texts.report.sections.concepts}`, '');
      if (!ctx.rows.length) out.push(mdText(Texts.report.noConcepts), '');
      for (const f of ctx.rows) {
        const c = f.concept;
        const name = mdText(Model.nameOrUnnamed(c));
        out.push(`### ${c.status === 'dropped' ? `~~${name}~~` : name} – ${mdText(statusText(c.status))}`, '');
        if (c.statusNote.trim()) out.push(`_${mdText(c.statusNote.trim()).replace(/\r?\n/g, ' ')}_`, '');
        if (c.note.trim()) out.push(mdText(c.note).replace(/\r?\n/g, '  \n'), '');
        const k = kpis(ctx, f, m).map(([l, v]) => `**${mdText(l)}:** ${mdText(v)}`);
        if (m.constraints.length) k.push(mdText(consText(m, c).text));
        if (k.length) out.push(k.join(' · '), '');
        table([Texts.compare.parameter, Texts.report.option], m.parameters.map((p, pi) => [Model.parameterLabel(p, pi), choice(p, c)]));
      }
      if (ctx.hidden) out.push(`_${mdText(Texts.report.droppedHidden(ctx.hidden))}_`, '');
    }
    if (parts.compare && ctx.rows.length) {
      out.push(`## ${Texts.report.sections.compare}`, '');
      const body = ctx.groups.flatMap(g => g.items.map(({ p, pi }) => [
        (ctx.showCats ? `${Model.categoryLabel(g.cat)} › ` : '') + Model.parameterLabel(p, pi),
        ...ctx.rows.map(({ concept: c }) => Model.optionText(p, c.selections[p.id]) || '–'),
      ]));
      const best = (/** @type {string} */ s, /** @type {boolean} */ b) => (b ? `**${s}**` : s);
      if (ctx.costs) body.push([Texts.compare.totalCost, ...ctx.rows.map(f => (f.cost ? best(ctx.money(f.cost.total) + (f.cost.missing ? ' *' : ''), f.cost.best) : '–'))]);
      if (ctx.utility) body.push([Texts.compare.utility(m.settings.utilityMax), ...ctx.rows.map(f => (f.utility && f.utility.value != null ? best(Util.formatNumber(f.utility.value) + (f.utility.missing ? ' *' : ''), f.utility.best) : '–'))]);
      for (const row of criteriaRows(m, ctx)) body.push([row.label, ...ctx.rows.map(f => { const x = row.cell(f); return x ? best(x.text, x.best) : '–'; })]);
      if (ctx.costs && ctx.utility) body.push([Texts.compare.priceValue, ...ctx.rows.map(f => (f.priceValue && f.priceValue.value != null ? best(ctx.money(f.priceValue.value), f.priceValue.best) : '–'))]);
      if (ctx.moscow) body.push([Texts.compare.priority, ...ctx.rows.map(f => (f.priority ? priorityText(f.priority) : '–'))]);
      table([Texts.compare.parameter, ...ctx.rows.map(f => Model.nameOrUnnamed(f.concept))], body);
    }
    if (parts.matrix && m.parameters.length) {
      out.push(`## ${Texts.report.sections.matrix}`, '');
      const cols = Math.max(1, ...m.parameters.map(p => p.options.length));
      const shown = ctx.rows.map(r => r.concept);
      /** @type {string[]} */
      const notes = [];
      const body = ctx.groups.flatMap(g => g.items.map(({ p, pi }) => {
        if (p.note.trim()) notes.push(`- **${mdText(Model.parameterLabel(p, pi))}:** ${mdText(p.note).replace(/\r?\n/g, ' ')}`);
        const cells = p.options.map((o, oi) => {
          const text = o.text.trim() || Texts.fallback.emptyOption(oi + 1);
          if (o.note.trim()) notes.push(`- **${mdText(text)}** (${mdText(Model.parameterLabel(p, pi))}): ${mdText(o.note).replace(/\r?\n/g, ' ')}`);
          const by = shown.filter(c => c.selections[p.id] === o.id).map(Model.nameOrUnnamed);
          const metrics = optionMetrics(ctx, m, o);
          return [text, metrics && `(${metrics})`, by.length && `– ${Texts.report.chosenBy(by.join(', '))}`].filter(Boolean).join(' ');
        });
        while (cells.length < cols) cells.push('');
        return [(ctx.showCats ? `${Model.categoryLabel(g.cat)} › ` : '') + Model.parameterLabel(p, pi), ...cells];
      }));
      table([Texts.compare.parameter, ...Array.from({ length: cols }, (_, i) => `${Texts.report.option} ${i + 1}`)], body);
      if (notes.length) out.push(`### ${Texts.report.sections.notes}`, '', ...notes, '');
    }
    if (parts.constraints && m.constraints.length) {
      out.push(`## ${Texts.report.sections.constraints}`, '');
      const side = (/** @type {string} */ oid) => {
        const r = Model.findOption(m, oid);
        return r ? `${optionName(m, oid)} (${Model.parameterLabel(r.p, r.pi)})` : '?';
      };
      table([Texts.report.option, Texts.report.option, Texts.cons.compareRow, Texts.cons.noteHeading],
        m.constraints.map(x => [side(x.a), side(x.b), `${x.type === 'excluded' ? '✕' : '!'} ${Texts.cons.types[x.type]}`, x.note]));
    }
    out.push('---', '', `_${mdText(Texts.report.footer(Model.SCHEMA_VERSION))}_`, '');
    return out.join('\n');
  }

  return { defaultParts, toHtml, toMarkdown, esc };
})();
