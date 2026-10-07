/*
 * Verbindungslinien der Konzepte im Modus „Kombinieren“ (SVG über der Matrix).
 * Linien verlaufen in den Zeilenabständen und enden an eingeklappten Kategorien.
 * Modus (prefs.lines): „all“ alle deutlich, „active“ nur das aktive Konzept deutlich (andere
 * dezent), „off“ keine. Beim Darüberfahren über ein Konzept wird dessen Linie hervorgehoben.
 */
'use strict';

let linesFrame = 0;
/** Konzept, über dem gerade der Mauszeiger steht (Hervorhebung), sonst `null`. @type {string | null} */
let hoveredConcept = null;
/** Linien im nächsten Frame neu zeichnen (fasst mehrere Anforderungen zusammen). */
function scheduleLines() {
  cancelAnimationFrame(linesFrame);
  linesFrame = requestAnimationFrame(drawLines);
}

function drawLines() {
  const svg = $('#lines');
  const wrap = $('#matrixWrap');
  svg.replaceChildren();
  if (prefs.mode !== 'select' || prefs.lines === 'off') return;

  const wr = wrap.getBoundingClientRect();
  svg.style.width = `${wrap.scrollWidth}px`;
  svg.style.height = `${wrap.scrollHeight}px`;
  const ns = 'http://www.w3.org/2000/svg';
  const n = state.concepts.length;

  // Aktives Konzept zuletzt zeichnen, damit es oben liegt.
  const order = state.concepts
    .map((c, ci) => ({ c, ci }))
    .sort((a, b) => Number(a.c.id === state.activeConceptId) - Number(b.c.id === state.activeConceptId));

  for (const { c, ci } of order) {
    /** Punkte je gewählter Ausprägung; `null` = Unterbrechung (eingeklappte Kategorie). */
    const pts = [];
    for (const p of state.parameters) {
      if (state.categories.length && isCollapsed(p.categoryId)) {
        if (pts.length && pts[pts.length - 1] !== null) pts.push(null);
        continue;
      }
      const oid = c.selections[p.id];
      if (!oid) continue;
      const el = wrap.querySelector(`[data-cell="${CSS.escape(`${p.id}:${oid}`)}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // Mehrere Konzepte in derselben Zelle leicht versetzt zeichnen
      const spread = Math.min(6, (r.width - 24) / Math.max(1, n));
      const x = r.left - wr.left + r.width / 2 + (ci - (n - 1) / 2) * spread;
      pts.push({ x, top: r.top - wr.top, bottom: r.bottom - wr.top });
    }
    let d = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (!a || !b) continue;
      const dy = (b.top - a.bottom) / 2;
      d += `M${a.x.toFixed(1)},${a.bottom.toFixed(1)} C${a.x.toFixed(1)},${(a.bottom + dy).toFixed(1)} ${b.x.toFixed(1)},${(b.top - dy).toFixed(1)} ${b.x.toFixed(1)},${b.top.toFixed(1)} `;
    }
    if (!d) continue;
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', shownColor(c.color));
    path.dataset.cid = c.id;
    svg.append(path);
  }
  emphasizeConcepts();
}

/**
 * Deutlichkeit der Linien nach Modus, aktivem und hervorgehobenem Konzept setzen – ohne neu zu
 * zeichnen (auch für das Verlaufsdiagramm im Konzeptvergleich).
 */
function emphasizeConcepts() {
  const dimmed = prefs.lines === 'active' ? '.12' : '.55';
  $$('#lines path, #compareChart [data-cid]').forEach(el => {
    const cid = /** @type {HTMLElement} */ (/** @type {unknown} */ (el)).dataset.cid;
    const strong = cid === state.activeConceptId || cid === hoveredConcept;
    const faint = hoveredConcept != null && !strong;
    el.classList.toggle('is-strong', strong);
    if (el.closest('#lines')) {
      el.setAttribute('stroke-width', strong ? '3' : '2');
      el.setAttribute('opacity', strong ? '1' : (faint ? '.08' : dimmed));
    } else {
      el.classList.toggle('is-faint', faint);
    }
  });
  // Aktives und hervorgehobenes Konzept nach oben (in dieser Reihenfolge)
  for (const cid of [state.activeConceptId, hoveredConcept]) {
    if (!cid) continue;
    $$(`#lines [data-cid="${CSS.escape(cid)}"], #compareChart g[data-cid="${CSS.escape(cid)}"]`)
      .forEach(el => el.parentNode && el.parentNode.append(el));
  }
}

/** Konzept beim Darüberfahren hervorheben (`null` = keines). @param {string | null} cid */
function hoverConcept(cid) {
  if (hoveredConcept === cid) return;
  hoveredConcept = cid;
  emphasizeConcepts();
}
