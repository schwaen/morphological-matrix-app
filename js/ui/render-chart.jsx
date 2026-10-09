/*
 * Verlaufsdiagramm im Konzeptvergleich (Parallelkoordinaten): je Parameter eine senkrechte
 * Achse mit seinen Ausprägungen, je Konzept ein Linienzug durch die gewählten Ausprägungen.
 * Ohne Auswahl bei einem Parameter ist der Linienzug dort unterbrochen. Aktives und
 * hervorgehobenes Konzept (Darüberfahren) liegen oben und sind betont.
 */
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { setActiveConcept } from './actions.js';
import { state, useMatrix } from './core.js';
import { shownColor } from './dom.jsx';
import { hovered, hoverConcept } from './lines.js';
import { categoryColor } from './render-matrix.jsx';

const CHART = { colW: 132, rowH: 28, padX: 16, catH: 22, headH: 30, gap: 10, bottom: 12 };

/** Text auf etwa `px` Breite kürzen (Schätzung über die mittlere Zeichenbreite). @param {string} text @param {number} px @param {number} [charW] */
function fitText(text, px, charW = 6.4) {
  const max = Math.max(3, Math.floor(px / charW));
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Beschriftung, gekürzt, mit vollständigem Text als Tooltip.
 * @param {{ text: string, px: number, charW?: number, [attr: string]: any }} props
 */
function Label({ text, px, charW, ...attrs }) {
  const shown = fitText(text, px, charW);
  return <text {...attrs}>{shown}{shown !== text ? <title>{text}</title> : null}</text>;
}

/**
 * @param {{ content: () => CompareContent }} props `content`: Inhalt des Vergleichs
 */
export function CompareChart({ content }) {
  useMatrix();
  const hot = hovered.value;
  const [axis, setAxis] = useState(/** @type {number | null} */ (null));
  const view = content();
  const m = state;
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
  /** Betonung je Konzept: aktiv oder hervorgehoben; die übrigen treten zurück, solange eines hervorgehoben ist. */
  const emphasis = (/** @type {string} */ cid) => {
    const strong = cid === m.activeConceptId || cid === hot;
    return `${strong ? ' is-strong' : ''}${hot != null && !strong ? ' is-faint' : ''}`;
  };
  // Aktives und hervorgehobenes Konzept zuletzt zeichnen, damit sie oben liegen
  const rank = (/** @type {string} */ cid) => (cid === hot ? 2 : cid === m.activeConceptId ? 1 : 0);
  const order = m.concepts.map((c, ci) => ({ c, ci })).sort((a, b) => rank(a.c.id) - rank(b.c.id));

  // Kategorien als Bänder über ihren Achsen
  let j0 = 0;
  const bands = catH ? view.groups.filter(g => g.items.length).map(g => {
    const x = padX + j0 * colW;
    const w = g.items.length * colW;
    j0 += g.items.length;
    return (
      <g key={g.cat ? g.cat.id : ''} class="pc-cat" style={{ '--k': categoryColor(g.cat) }}>
        <rect x={x + 2} y={0} width={w - 4} height={catH - 6} rx={4} />
        <Label text={Model.categoryLabel(g.cat)} px={w - 16} x={x + 10} y={catH - 10} />
      </g>
    );
  }) : null;

  return (
    <>
      <ul class="pc-legend" aria-label={Texts.chart.legend}>
        {view.ranked.map(({ figures: { concept: c }, rank: r }) => (
          <li key={c.id}>
            <button
              type="button" class={`pc-key${emphasis(c.id)}`} data-cid={c.id} style={{ '--c': shownColor(c.color) }}
              aria-pressed={c.id === m.activeConceptId}
              onMouseEnter={() => hoverConcept(c.id)} onMouseLeave={() => hoverConcept(null)}
              onFocus={() => hoverConcept(c.id)} onBlur={() => hoverConcept(null)}
              onClick={() => setActiveConcept(c.id)}
            >
              <span class="pc-swatch" aria-hidden="true" />
              {r != null ? <span class="pc-rank" title={Texts.compare.rankTitle(r)}>{`${r}.`}</span> : null}
              {Model.nameOrUnnamed(c)}
            </button>
          </li>
        ))}
      </ul>
      {params.length ? (
        <div class="pc-plot">
          <svg
            class="pc-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
            style={{ width: `${width}px`, height: `${height}px` }} role="group" aria-label={Texts.chart.label}
          >
            {bands}
            <rect
              class="pc-guide" x={axis == null ? 0 : padX + axis * colW} y={catH} width={colW} height={height - catH} rx={6}
              visibility={axis == null ? 'hidden' : 'visible'}
            />
            {/* Achsen mit Parametername und Ausprägungen */}
            {params.map((p, j) => (
              <g key={p.id} class="pc-axis" data-pid={p.id}>
                <Label text={Model.parameterLabel(p, m.parameters.indexOf(p))} px={colW - 12} charW={6.8} class="pc-param" x={axisX(j) - 6} y={catH + CHART.headH - 8} />
                <line x1={axisX(j)} x2={axisX(j)} y1={optY(0)} y2={optY(Math.max(0, p.options.length - 1))} />
                {p.options.map((o, i) => <circle key={o.id} class="pc-tick" cx={axisX(j)} cy={optY(i)} r={2.5} />)}
              </g>
            ))}
            {/* Linienzüge und Punkte je Konzept */}
            {order.map(({ c, ci }) => {
              let d = '';
              let open = false;
              const dots = [];
              params.forEach((p, j) => {
                const i = p.options.findIndex(o => o.id === c.selections[p.id]);
                if (i < 0) { open = false; return; }
                const x = (axisX(j) + offset(ci)).toFixed(1);
                const y = (optY(i) + offset(ci)).toFixed(1);
                d += `${open ? 'L' : 'M'}${x},${y} `;
                open = true;
                dots.push(<circle key={p.id} class="pc-dot" cx={x} cy={y} r={4.5} />);
              });
              return (
                <g key={c.id} class={`pc-concept${emphasis(c.id)}`} data-cid={c.id} style={{ '--c': shownColor(c.color) }}>
                  {d ? <path class="pc-line" d={d} /> : null}
                  {dots}
                </g>
              );
            })}
            {/* Beschriftungen der Ausprägungen über den Linien (mit Hof in Flächenfarbe) */}
            {params.map((p, j) => (
              <g key={p.id} class="pc-opts">
                {p.options.map((o, i) => <Label key={o.id} text={Model.optionText(p, o.id) || '–'} px={colW - 22} x={axisX(j) + 9} y={optY(i) + 4} />)}
              </g>
            ))}
            {/* Trefferflächen je Achse für Tooltip und Tastatur */}
            {params.map((p, j) => {
              const name = Model.parameterLabel(p, m.parameters.indexOf(p));
              const options = p.options.map(o => Model.optionText(p, o.id)).filter(Boolean).join(', ') || Texts.chart.noOptions;
              return (
                <rect
                  key={p.id} class="pc-hit" x={padX + j * colW} y={catH} width={colW} height={height - catH}
                  tabIndex={0} role="img" aria-label={Texts.chart.axisLabel(name, options)}
                  onMouseEnter={() => setAxis(j)} onFocus={() => setAxis(j)}
                  onMouseLeave={() => setAxis(null)} onBlur={() => setAxis(null)}
                />
              );
            })}
          </svg>
          <AxisTip p={axis == null ? null : params[axis] ?? null} j={axis ?? 0} top={plotTop - 4} />
        </div>
      ) : <p class="pc-empty">{Texts.compare.noDifferences}</p>}
    </>
  );
}

/**
 * Tooltip einer Achse: Parameter und die Wahl jedes Konzepts; rechts neben der Achse, am
 * rechten Rand des sichtbaren Bereichs nach links umgeklappt.
 * @param {{ p: MatrixParameter | null, j: number, top: number }} props
 */
function AxisTip({ p, j, top }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  useLayoutEffect(() => {
    const tip = ref.current;
    const scroller = document.getElementById('compareBody');
    if (!tip || !p || !scroller) return;
    const left = CHART.padX + (j + 1) * CHART.colW + 4;
    const fitsRight = left + tip.offsetWidth <= scroller.scrollLeft + scroller.clientWidth;
    tip.style.left = `${fitsRight ? left : Math.max(0, CHART.padX + j * CHART.colW - tip.offsetWidth - 4)}px`;
  });
  return (
    <div ref={ref} class="pc-tip" role="status" hidden={!p} style={{ top: `${top}px` }}>
      {p ? (
        <>
          <strong>{Model.parameterLabel(p, state.parameters.indexOf(p))}</strong>
          <ul>
            {state.concepts.map(c => {
              const text = Model.optionText(p, c.selections[p.id]);
              return (
                <li key={c.id} style={{ '--c': shownColor(c.color) }}>
                  <span class="pc-swatch" aria-hidden="true" />
                  <span class="pc-tip-name">{Model.nameOrUnnamed(c)}</span>
                  <span class={text ? undefined : 'none'}>{text || Texts.summary.notSelected}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
