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
import { ScatterLayout } from '../scatter-layout.js';
import { Util } from '../util.js';

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
  const {
    W, H, pad: PAD, plotR, X, Y, xTicks, yTicks, frontPath, frontArea, frontLabelY, hasFront, labels, dot: DOT,
  } = ScatterLayout.layout(pts.map(q => ({
    cost: q.f.cost, utility: q.f.utility, front: q.f.front, active: q.c.id === state.activeConceptId,
    label: `${Model.nameOrUnnamed(q.c)}${q.f.complete ? '' : ' *'}`,
  })), { width, yMax: state.settings.utilityMax, frontLabel: Texts.scatter.front });
  const yMax = state.settings.utilityMax;
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
            {hasFront ? (
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
