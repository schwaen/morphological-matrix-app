/*
 * Verlaufsdiagramm im Konzeptvergleich (Parallelkoordinaten): je Parameter eine senkrechte
 * Achse mit seinen Ausprägungen, je Konzept ein Linienzug durch die gewählten Ausprägungen.
 * Ohne Auswahl bei einem Parameter ist der Linienzug dort unterbrochen.
 * Hervorhebung (aktives Konzept, Darüberfahren) übernimmt `emphasizeConcepts()` in lines.js.
 */
'use strict';

const CHART = { colW: 132, rowH: 28, padX: 16, catH: 22, headH: 30, gap: 10, bottom: 12 };

/** SVG-Element erzeugen. @param {string} tag @param {Record<string, any>} [attrs] @param {...any} children @returns {any} */
function svgEl(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (val == null || val === false) continue;
    if (key === 'dataset') Object.assign(/** @type {any} */ (el).dataset, val);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), val);
    else el.setAttribute(key, String(val));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** Text auf etwa `px` Breite kürzen (Schätzung über die mittlere Zeichenbreite). @param {string} text @param {number} px @param {number} [charW] */
function fitText(text, px, charW = 6.4) {
  const max = Math.max(3, Math.floor(px / charW));
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Beschriftung, gekürzt, mit vollständigem Text als Tooltip. */
function chartLabel(text, px, attrs, charW) {
  const shown = fitText(text, px, charW);
  return svgEl('text', attrs, shown, shown !== text ? svgEl('title', {}, text) : null);
}

/** @param {CompareContent} view */
function buildCompareChart(view) {
  const m = state;
  const root = $('#compareChart');
  const params = view.groups.flatMap(g => g.items.map(({ p }) => p));
  const n = m.concepts.length;
  const { colW, rowH, padX, gap, bottom } = CHART;
  const catH = m.categories.length ? CHART.catH : 0;
  const maxOpts = Math.max(1, ...params.map(p => p.options.length));
  const plotTop = catH + CHART.headH + gap;
  const width = padX * 2 + params.length * colW;
  const height = plotTop + maxOpts * rowH + bottom;
  const axisX = (/** @type {number} */ j) => padX + j * colW + 6;
  const optY = (/** @type {number} */ i) => plotTop + i * rowH + rowH / 2;
  // Mehrere Konzepte auf derselben Ausprägung leicht versetzt zeichnen
  const spread = n > 1 ? Math.min(3, 12 / (n - 1)) : 0;
  const offset = (/** @type {number} */ ci) => (ci - (n - 1) / 2) * spread;

  // Kategorien als Bänder über ihren Achsen
  const bands = [];
  if (catH) {
    let j = 0;
    for (const g of view.groups) {
      if (!g.items.length) continue;
      const x = padX + j * colW;
      const w = g.items.length * colW;
      bands.push(svgEl('g', { class: 'pc-cat', style: `--k:${categoryColor(g.cat)}` },
        svgEl('rect', { x: x + 2, y: 0, width: w - 4, height: catH - 6, rx: 4 }),
        chartLabel(Model.categoryLabel(g.cat), w - 16, { x: x + 10, y: catH - 10 })));
      j += g.items.length;
    }
  }

  // Achsen mit Parametername und Ausprägungen
  const axes = params.map((p, j) => {
    const x = axisX(j);
    const last = Math.max(0, p.options.length - 1);
    return svgEl('g', { class: 'pc-axis', dataset: { pid: p.id } },
      chartLabel(Model.parameterLabel(p, m.parameters.indexOf(p)), colW - 12, { class: 'pc-param', x: x - 6, y: catH + CHART.headH - 8 }, 6.8),
      svgEl('line', { x1: x, x2: x, y1: optY(0), y2: optY(last) }),
      p.options.map((o, i) => svgEl('circle', { class: 'pc-tick', cx: x, cy: optY(i), r: 2.5 })));
  });

  // Linienzüge und Punkte je Konzept
  const marks = m.concepts.map((c, ci) => {
    const color = shownColor(c.color);
    let d = '';
    let open = false;
    const dots = [];
    params.forEach((p, j) => {
      const i = p.options.findIndex(o => o.id === c.selections[p.id]);
      if (i < 0) { open = false; return; }
      const x = axisX(j) + offset(ci);
      const y = optY(i) + offset(ci);
      d += `${open ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
      open = true;
      dots.push(svgEl('circle', { class: 'pc-dot', cx: x.toFixed(1), cy: y.toFixed(1), r: 4.5 }));
    });
    return svgEl('g', { class: 'pc-concept', dataset: { cid: c.id }, style: `--c:${color}` },
      d ? svgEl('path', { class: 'pc-line', d }) : null, dots);
  });

  // Beschriftungen der Ausprägungen über den Linien (mit Hof in Flächenfarbe)
  const labels = params.map((p, j) => svgEl('g', { class: 'pc-opts' },
    p.options.map((o, i) => chartLabel(Model.optionText(p, o.id) || '–', colW - 22, { x: axisX(j) + 9, y: optY(i) + 4 }))));

  // Trefferflächen je Achse für Tooltip und Tastatur
  const tip = h('div', { class: 'pc-tip', role: 'status', hidden: true, style: { top: `${plotTop - 4}px` } });
  const guide = svgEl('rect', { class: 'pc-guide', x: 0, y: catH, width: colW, height: height - catH, rx: 6, visibility: 'hidden' });
  const hits = params.map((p, j) => {
    const name = Model.parameterLabel(p, m.parameters.indexOf(p));
    const options = p.options.map(o => Model.optionText(p, o.id)).filter(Boolean).join(', ') || Texts.chart.noOptions;
    const show = () => showChartTip(tip, guide, p, j, name);
    return svgEl('rect', {
      class: 'pc-hit', x: padX + j * colW, y: catH, width: colW, height: height - catH,
      tabindex: 0, role: 'img', 'aria-label': Texts.chart.axisLabel(name, options),
      onmouseenter: show, onfocus: show, onmouseleave: () => hideChartTip(tip, guide), onblur: () => hideChartTip(tip, guide),
    });
  });

  const svg = svgEl('svg', {
    class: 'pc-svg', width, height, viewBox: `0 0 ${width} ${height}`, style: `width:${width}px;height:${height}px`,
    role: 'group', 'aria-label': Texts.chart.label,
  }, bands, guide, axes, marks, labels, hits);

  const legend = h('ul', { class: 'pc-legend', 'aria-label': Texts.chart.legend },
    view.ranked.map(({ figures: { concept: c }, rank }) => h('li', null, h('button', {
      type: 'button', class: 'pc-key', dataset: { cid: c.id }, style: { '--c': shownColor(c.color) },
      'aria-pressed': String(c.id === m.activeConceptId),
      onmouseenter: () => hoverConcept(c.id), onmouseleave: () => hoverConcept(null),
      onfocus: () => hoverConcept(c.id), onblur: () => hoverConcept(null),
      onclick: () => setActiveConcept(c.id),
    }, h('span', { class: 'pc-swatch', 'aria-hidden': 'true' }),
    rank != null ? h('span', { class: 'pc-rank', title: Texts.compare.rankTitle(rank) }, `${rank}.`) : null,
    Model.nameOrUnnamed(c)))));

  // Fokus in der Legende über das Neuzeichnen hinweg erhalten
  const focused = /** @type {HTMLElement | null} */ (root.querySelector('.pc-key:focus'));
  root.replaceChildren(legend, params.length
    ? h('div', { class: 'pc-plot' }, svg, tip)
    : h('p', { class: 'pc-empty' }, Texts.compare.noDifferences));
  if (focused) $(`.pc-key[data-cid="${CSS.escape(focused.dataset.cid || '')}"]`, root)?.focus();
  emphasizeConcepts();
}

/** Tooltip einer Achse: Parameter und die Wahl jedes Konzepts. */
function showChartTip(tip, guide, p, j, name) {
  guide.setAttribute('x', String(CHART.padX + j * CHART.colW));
  guide.setAttribute('visibility', 'visible');
  replaceWith(tip, h('strong', null, name), h('ul', null, state.concepts.map(c => {
    const text = Model.optionText(p, c.selections[p.id]);
    return h('li', { style: { '--c': shownColor(c.color) } },
      h('span', { class: 'pc-swatch', 'aria-hidden': 'true' }),
      h('span', { class: 'pc-tip-name' }, Model.nameOrUnnamed(c)),
      h('span', text ? null : { class: 'none' }, text || Texts.summary.notSelected));
  })));
  tip.hidden = false;
  // Rechts neben der Achse, am rechten Rand nach links umklappen
  const scroller = $('#compareBody');
  const left = CHART.padX + (j + 1) * CHART.colW + 4;
  const fitsRight = left + tip.offsetWidth <= scroller.scrollLeft + scroller.clientWidth;
  tip.style.left = `${fitsRight ? left : Math.max(0, CHART.padX + j * CHART.colW - tip.offsetWidth - 4)}px`;
}

function hideChartTip(tip, guide) {
  tip.hidden = true;
  guide.setAttribute('visibility', 'hidden');
}
