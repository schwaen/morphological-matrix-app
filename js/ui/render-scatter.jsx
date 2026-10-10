/*
 * Konzeptvergleich „Kosten/Nutzen“: je Konzept ein Punkt (Gesamtkosten nach rechts, Nutzwert
 * nach oben) mit Pareto-Front (Evaluation.pareto). Übertroffene Konzepte sind blass,
 * unvollständig bewertete hohl. Nur bei aktivierten Kosten und Nutzwert.
 */
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Evaluation } from '../evaluation.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { setActiveConcept } from './actions.js';
import { money, state, useMatrix } from './core.js';
import { shownColor } from './dom.jsx';
import { hovered, hoverConcept } from './lines.js';
import { ChartLegend, emphasisClass } from './render-chart.jsx';
import { Util } from '../util.js';

const PAD = { left: 64, right: 28, top: 14, bottom: 46 };
const DOT = 6;
/** Geschätzte Zeichenbreite der Punktbeschriftung (12px, halbfett). */
const CHAR_W = 6.9;

/** „Schöne“ Schrittweite für etwa `n` Abschnitte bis `max`. @param {number} max @param {number} n */
function niceStep(max, n) {
  const raw = max / n;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/** @typedef {{ x1: number, x2: number, y1: number, y2: number }} Box */

/**
 * Beschriftungen ohne Überschneidung: je Punkt der erste freie Platz aus rechts, links, oben,
 * unten. Ohne freien Platz bleibt der Punkt unbeschriftet (Legende und Tooltip nennen ihn) –
 * außer bei `must` (aktives Konzept), das dann rechts bzw. links beschriftet wird.
 * `obstacles`: weitere belegte Flächen (Linie und Beschriftung der Front).
 * @param {Array<{ x: number, y: number, text: string, must: boolean }>} pts @param {number} left @param {number} right
 * @param {Box[]} obstacles
 * @returns {Array<{ x: number, y: number, anchor: 'start' | 'end' } | null>}
 */
function placeLabels(pts, left, right, obstacles) {
  /** @type {Box[]} */
  const taken = [...pts.map(p => ({ x1: p.x - DOT, x2: p.x + DOT, y1: p.y - DOT, y2: p.y + DOT })), ...obstacles];
  const hit = (/** @type {{ x1: number, x2: number, y1: number, y2: number }} */ b) =>
    taken.some(t => b.x1 < t.x2 && b.x2 > t.x1 && b.y1 < t.y2 && b.y2 > t.y1);
  return pts.map(p => {
    const w = p.text.length * CHAR_W;
    /** @type {Array<{ x: number, y: number, anchor: 'start' | 'end' }>} */
    const tries = [
      { x: p.x + 10, y: p.y + 4, anchor: 'start' }, { x: p.x - 10, y: p.y + 4, anchor: 'end' },
      { x: p.x - 10, y: p.y - 10, anchor: 'end' }, { x: p.x + 10, y: p.y - 10, anchor: 'start' },
      { x: p.x + 10, y: p.y + 18, anchor: 'start' }, { x: p.x - 10, y: p.y + 18, anchor: 'end' },
    ];
    const box = (/** @type {{ x: number, y: number, anchor: string }} */ t) => /** @type {Box} */ ({
      x1: t.anchor === 'start' ? t.x : t.x - w, x2: t.anchor === 'start' ? t.x + w : t.x, y1: t.y - 11, y2: t.y + 3,
    });
    const fits = (/** @type {{ x: number, y: number, anchor: string }} */ t) => { const b = box(t); return b.x1 >= left && b.x2 <= right && !hit(b); };
    const best = tries.find(fits) || (p.must ? tries[p.x + 10 + w <= right ? 0 : 1] : null);
    if (best) taken.push(box(best));
    return best;
  });
}

/**
 * @param {{ content: () => CompareContent }} props `content`: Inhalt des Vergleichs (Reihenfolge, ausgeblendete Konzepte)
 */
export function CompareScatter({ content }) {
  useMatrix();
  const hot = hovered.value;
  const wrap = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [width, setWidth] = useState(900);
  const [tip, setTip] = useState(/** @type {string | null} */ (null));
  // Breite folgt dem Container, damit die Schrift auch auf schmalen Bildschirmen lesbar bleibt
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(el);
      setWidth(Math.max(280, el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { ranked } = content();
  const front = Evaluation.pareto(ranked.map(r => r.figures));
  /** @type {ScatterPoint[]} */
  const pts = ranked.filter(r => front.has(r.figures.concept.id)).map(r => {
    const c = r.figures.concept;
    const f = /** @type {ParetoPoint} */ (front.get(c.id));
    const missing = (r.figures.cost?.missing ?? 0) + (r.figures.utility?.missing ?? 0);
    return { c, f, missing, figures: r.figures };
  });
  const hiddenCount = ranked.length - pts.length;
  const yMax = state.settings.utilityMax;
  const xStep = niceStep(Math.max(1, ...pts.map(q => q.f.cost)) * 1.08, 5);
  const xMax = Math.max(xStep, Math.ceil((Math.max(0, ...pts.map(q => q.f.cost)) * 1.08) / xStep) * xStep);
  const W = width;
  const H = Math.round(Math.min(420, Math.max(280, W * 0.42)));
  const plotR = W - PAD.right;
  const X = (/** @type {number} */ v) => PAD.left + (v / xMax) * (plotR - PAD.left);
  const Y = (/** @type {number} */ v) => PAD.top + (1 - v / yMax) * (H - PAD.top - PAD.bottom);
  const xTicks = Array.from({ length: Math.round(xMax / xStep) + 1 }, (_, i) => i * xStep);
  const yTicks = Array.from({ length: 6 }, (_, i) => (i * yMax) / 5);

  // Pareto-Front als Treppe von links unten nach rechts oben; Fläche rechts darunter ist übertroffen
  const onFront = pts.filter(q => q.f.front).sort((a, b) => a.f.cost - b.f.cost || a.f.utility - b.f.utility);
  /** Ecken der Treppe; die Linie belegt Platz, den Beschriftungen meiden. */
  const corners = onFront.flatMap((q, i) => [
    ...(i ? [{ x: X(q.f.cost), y: Y(onFront[i - 1].f.utility) }] : []), { x: X(q.f.cost), y: Y(q.f.utility) },
  ]);
  if (corners.length) corners.push({ x: X(xMax), y: corners[corners.length - 1].y });
  const frontPath = corners.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const frontArea = corners.length ? `${frontPath} L${X(xMax)},${Y(0)} L${corners[0].x},${Y(0)} Z` : '';
  const frontLabelY = corners.length ? corners[corners.length - 1].y - 8 : 0;
  /** @type {Box[]} */
  const obstacles = corners.slice(1).map((p, i) => {
    const a = corners[i];
    return { x1: Math.min(a.x, p.x) - 2, x2: Math.max(a.x, p.x) + 2, y1: Math.min(a.y, p.y) - 2, y2: Math.max(a.y, p.y) + 2 };
  });
  if (corners.length) obstacles.push({ x1: plotR - 4 - Texts.scatter.front.length * 6, x2: plotR, y1: frontLabelY - 11, y2: frontLabelY + 3 });
  // Aktives Konzept zuerst, damit es seinen Platz sicher bekommt
  const labelOrder = pts.map((q, i) => i).sort((a, b) => Number(pts[b].c.id === state.activeConceptId) - Number(pts[a].c.id === state.activeConceptId));
  const placed = placeLabels(labelOrder.map(i => {
    const q = pts[i];
    return { x: X(q.f.cost), y: Y(q.f.utility), text: `${Model.nameOrUnnamed(q.c)}${q.f.complete ? '' : ' *'}`, must: q.c.id === state.activeConceptId };
  }), PAD.left, plotR, obstacles);
  /** @type {Array<{ x: number, y: number, anchor: 'start' | 'end' } | null>} */
  const labels = [];
  labelOrder.forEach((i, k) => { labels[i] = placed[k]; });
  // Aktives Konzept zuletzt zeichnen, damit es oben liegt (nicht das hervorgehobene: der Punkt
  // unter der Maus würde sonst im DOM verschoben)
  const order = pts.map((q, i) => ({ q, i })).sort((a, b) => Number(a.q.c.id === state.activeConceptId) - Number(b.q.c.id === state.activeConceptId));
  const tipPoint = tip ? pts.find(q => q.c.id === tip) : null;

  return (
    <>
      <ChartLegend ranked={ranked} />
      <div class="sc-wrap" ref={wrap}>
        {pts.length ? (
          <svg
            class="sc-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: `${W}px`, height: `${H}px` }}
            role="group" aria-label={Texts.scatter.label}
          >
            <g class="sc-grid" aria-hidden="true">
              {xTicks.map(v => <line key={`x${v}`} x1={X(v)} x2={X(v)} y1={PAD.top} y2={H - PAD.bottom} />)}
              {yTicks.map(v => <line key={`y${v}`} x1={PAD.left} x2={plotR} y1={Y(v)} y2={Y(v)} />)}
            </g>
            {frontArea ? <path class="sc-dominated" d={frontArea} aria-hidden="true" /> : null}
            {frontPath ? <path class="sc-front" d={frontPath} aria-hidden="true" /> : null}
            {corners.length ? (
              <text class="sc-front-label" x={plotR - 4} y={frontLabelY} text-anchor="end" aria-hidden="true">{Texts.scatter.front}</text>
            ) : null}
            <g class="sc-axis" aria-hidden="true">
              {xTicks.filter((_, i) => xTicks.length <= 6 || i % 2 === 0).map(v => (
                <text key={`x${v}`} x={X(v)} y={H - PAD.bottom + 18} text-anchor="middle">{Util.formatMoney(v, state.settings.currency, true)}</text>
              ))}
              {yTicks.map(v => <text key={`y${v}`} x={PAD.left - 10} y={Y(v) + 4} text-anchor="end">{Util.formatNumber(v)}</text>)}
              <text class="sc-title" x={(PAD.left + plotR) / 2} y={H - 6} text-anchor="middle">{Texts.scatter.axisCost}</text>
              <text class="sc-title" transform={`translate(14 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)`} text-anchor="middle">{Texts.scatter.axisUtility(yMax)}</text>
            </g>
            {order.map(({ q, i }) => {
              const x = X(q.f.cost);
              const y = Y(q.f.utility);
              const l = labels[i];
              const name = Model.nameOrUnnamed(q.c);
              return (
                <g
                  key={q.c.id} class={`sc-pt${q.f.complete ? '' : ' is-hollow'}${q.f.dominatedBy ? ' is-dominated' : ''}${emphasisClass(q.c.id, hot)}`}
                  data-cid={q.c.id} style={{ '--c': shownColor(q.c.color) }}
                >
                  <circle class="sc-dot" cx={x} cy={y} r={DOT} />
                  {l ? <text x={l.x} y={l.y} text-anchor={l.anchor}>{`${name}${q.f.complete ? '' : ' *'}`}</text> : null}
                  {/* Trefferfläche größer als der Punkt; auch per Tastatur erreichbar */}
                  <circle
                    class="sc-hit" cx={x} cy={y} r={14} tabIndex={0} role="img"
                    aria-label={Texts.scatter.point(name, money(q.f.cost), Util.formatNumber(q.f.utility))}
                    aria-description={tipNotes(q, front).join(' ')}
                    onMouseEnter={() => { setTip(q.c.id); hoverConcept(q.c.id); }} onFocus={() => { setTip(q.c.id); hoverConcept(q.c.id); }}
                    onMouseLeave={() => { setTip(null); hoverConcept(null); }} onBlur={() => { setTip(null); hoverConcept(null); }}
                    onClick={() => setActiveConcept(q.c.id)}
                  />
                </g>
              );
            })}
          </svg>
        ) : <p class="pc-empty">{Texts.scatter.empty}</p>}
        {tipPoint ? <ScatterTip q={tipPoint} front={front} x={X(tipPoint.f.cost)} y={Y(tipPoint.f.utility)} width={W} /> : null}
      </div>
      <div class="sc-keys">
        <span>
          <svg width="26" height="10" style={{ width: '26px', height: '10px' }} aria-hidden="true"><line x1="0" y1="5" x2="26" y2="5" class="sc-key-front" /></svg>
          {Texts.scatter.keyFront}
        </span>
        <span><svg width="12" height="12" style={{ width: '12px', height: '12px' }} aria-hidden="true"><circle cx="6" cy="6" r="4.5" class="sc-key-hollow" /></svg>{Texts.scatter.keyIncomplete}</span>
        <span><svg width="12" height="12" style={{ width: '12px', height: '12px' }} aria-hidden="true"><circle cx="6" cy="6" r="5" class="sc-key-faint" /></svg>{Texts.scatter.keyDominated}</span>
        {hiddenCount ? <span>{Texts.scatter.notShown(hiddenCount)}</span> : null}
      </div>
    </>
  );
}

/** @typedef {ReturnType<typeof Evaluation.pareto>} Pareto */
/** @typedef {NonNullable<ReturnType<Pareto['get']>>} ParetoPoint */
/** @typedef {{ c: MatrixConcept, f: ParetoPoint, missing: number, figures: ConceptFigures }} ScatterPoint */

/**
 * Hinweise zu einem Punkt: unvollständig, übertroffen (worin), auf der Front.
 * @param {ScatterPoint} q @param {Pareto} front
 */
function tipNotes(q, front) {
  const notes = [];
  if (!q.f.complete) notes.push(Texts.scatter.incomplete(q.missing));
  const d = q.f.dominatedBy;
  const o = d ? front.get(d.id) : null;
  if (d && o && q.f.complete) {
    const how = o.cost < q.f.cost && o.utility > q.f.utility ? 'both' : (o.cost < q.f.cost ? 'cost' : 'utility');
    notes.push(Texts.scatter.dominatedBy(Model.nameOrUnnamed(d), how));
  } else if (d) {
    notes.push(Texts.scatter.dominatedPrelim(Model.nameOrUnnamed(d)));
  }
  if (q.f.front) notes.push(Texts.scatter.onFront);
  return notes;
}

/**
 * Tooltip eines Punkts: Kennzahlen und Hinweise; rechts unterhalb, am rechten Rand nach links.
 * @param {{ q: ScatterPoint, front: Pareto, x: number, y: number, width: number }} props
 */
function ScatterTip({ q, front, x, y, width }) {
  const star = q.f.complete ? '' : ' *';
  const pv = q.figures.priceValue;
  const left = x + 240 + 16 > width ? Math.max(0, x - 16 - 240) : x + 16;
  return (
    <div class="sc-tip" role="status" style={{ left: `${left}px`, top: `${y + 12}px`, '--c': shownColor(q.c.color) }}>
      <strong><i aria-hidden="true" />{Model.nameOrUnnamed(q.c)}</strong>
      <dl>
        <dt>{Texts.compare.totalCost}</dt><dd>{money(q.f.cost) + star}</dd>
        <dt>{Texts.compare.utility(state.settings.utilityMax)}</dt><dd>{Util.formatNumber(q.f.utility) + star}</dd>
        <dt>{Texts.compare.priceValue}</dt><dd>{pv && pv.value != null ? money(pv.value) : '–'}</dd>
      </dl>
      {tipNotes(q, front).map(n => <p key={n}>{n}</p>)}
    </div>
  );
}
