/*
 * Geometrie des Kosten/Nutzen-Diagramms (ohne DOM): Skalen, Achsenteilung, Pareto-Treppe und
 * überschneidungsfreie Beschriftungen. Genutzt von der Ansicht im Konzeptvergleich
 * (js/ui/render-scatter.jsx) und vom Bericht (js/report.js).
 */

const PAD = { left: 64, right: 28, top: 14, bottom: 46 };
/** Radius der Punkte. */
const DOT = 6;
/** Geschätzte Zeichenbreite der Punktbeschriftung (12px, halbfett). */
const CHAR_W = 6.9;

/** @typedef {{ x1: number, x2: number, y1: number, y2: number }} Box */
/** @typedef {{ x: number, y: number, anchor: 'start' | 'end' }} LabelPos */

/** „Schöne“ Schrittweite für etwa `n` Abschnitte bis `max`. @param {number} max @param {number} n */
function niceStep(max, n) {
  const raw = max / n;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/**
 * Beschriftungen ohne Überschneidung: je Punkt der erste freie Platz aus rechts, links, oben,
 * unten. Ohne freien Platz bleibt der Punkt unbeschriftet – außer bei `must` (aktives Konzept),
 * das dann rechts bzw. links beschriftet wird. `obstacles`: weitere belegte Flächen.
 * @param {Array<{ x: number, y: number, text: string, must: boolean }>} pts @param {number} left @param {number} right
 * @param {Box[]} obstacles
 * @returns {Array<LabelPos | null>}
 */
function placeLabels(pts, left, right, obstacles) {
  /** @type {Box[]} */
  const taken = [...pts.map(p => ({ x1: p.x - DOT, x2: p.x + DOT, y1: p.y - DOT, y2: p.y + DOT })), ...obstacles];
  const hit = (/** @type {Box} */ b) => taken.some(t => b.x1 < t.x2 && b.x2 > t.x1 && b.y1 < t.y2 && b.y2 > t.y1);
  return pts.map(p => {
    const w = p.text.length * CHAR_W;
    /** @type {LabelPos[]} */
    const tries = [
      { x: p.x + 10, y: p.y + 4, anchor: 'start' }, { x: p.x - 10, y: p.y + 4, anchor: 'end' },
      { x: p.x - 10, y: p.y - 10, anchor: 'end' }, { x: p.x + 10, y: p.y - 10, anchor: 'start' },
      { x: p.x + 10, y: p.y + 18, anchor: 'start' }, { x: p.x - 10, y: p.y + 18, anchor: 'end' },
    ];
    const box = (/** @type {LabelPos} */ t) => /** @type {Box} */ ({
      x1: t.anchor === 'start' ? t.x : t.x - w, x2: t.anchor === 'start' ? t.x + w : t.x, y1: t.y - 11, y2: t.y + 3,
    });
    const fits = (/** @type {LabelPos} */ t) => { const b = box(t); return b.x1 >= left && b.x2 <= right && !hit(b); };
    const best = tries.find(fits) || (p.must ? tries[p.x + 10 + w <= right ? 0 : 1] : null);
    if (best) taken.push(box(best));
    return best;
  });
}

/**
 * Layout des Diagramms. Die Pareto-Front ist eine Treppe von links unten nach rechts oben; die
 * Fläche rechts darunter ist übertroffen. Das aktive Konzept wird zuerst beschriftet.
 * @param {Array<{ cost: number, utility: number, front: boolean, label: string, active: boolean }>} points
 * @param {{ width: number, yMax: number, frontLabel: string }} opts
 */
function layout(points, { width, yMax, frontLabel }) {
  const W = width;
  const H = Math.round(Math.min(420, Math.max(280, W * 0.42)));
  const plotR = W - PAD.right;
  const maxCost = Math.max(0, ...points.map(q => q.cost));
  const xStep = niceStep(Math.max(1, maxCost) * 1.08, 5);
  const xMax = Math.max(xStep, Math.ceil((maxCost * 1.08) / xStep) * xStep);
  const X = (/** @type {number} */ v) => PAD.left + (v / xMax) * (plotR - PAD.left);
  const Y = (/** @type {number} */ v) => PAD.top + (1 - v / yMax) * (H - PAD.top - PAD.bottom);
  const xTicks = Array.from({ length: Math.round(xMax / xStep) + 1 }, (_, i) => i * xStep);
  const yTicks = Array.from({ length: 6 }, (_, i) => (i * yMax) / 5);

  const onFront = points.filter(q => q.front).sort((a, b) => a.cost - b.cost || a.utility - b.utility);
  /** Ecken der Treppe; die Linie belegt Platz, den Beschriftungen meiden. */
  const corners = onFront.flatMap((q, i) => [
    ...(i ? [{ x: X(q.cost), y: Y(onFront[i - 1].utility) }] : []), { x: X(q.cost), y: Y(q.utility) },
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
  if (corners.length) obstacles.push({ x1: plotR - 4 - frontLabel.length * 6, x2: plotR, y1: frontLabelY - 11, y2: frontLabelY + 3 });
  const labelOrder = points.map((_, i) => i).sort((a, b) => Number(points[b].active) - Number(points[a].active));
  const placed = placeLabels(labelOrder.map(i => {
    const q = points[i];
    return { x: X(q.cost), y: Y(q.utility), text: q.label, must: q.active };
  }), PAD.left, plotR, obstacles);
  /** @type {Array<LabelPos | null>} */
  const labels = [];
  labelOrder.forEach((i, k) => { labels[i] = placed[k]; });
  return { W, H, pad: PAD, plotR, X, Y, xTicks, yTicks, frontPath, frontArea, frontLabelY, hasFront: corners.length > 0, labels, dot: DOT };
}

/** Namensraum der Diagramm-Geometrie. */
export const ScatterLayout = { layout, niceStep, placeLabels };
