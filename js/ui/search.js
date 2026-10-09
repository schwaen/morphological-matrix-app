/*
 * Suche in der Matrix: markiert Parameter und Ausprägungen, deren Text die Eingabe enthält,
 * blendet Zeilen ohne Treffer ab und springt mit Enter / Umschalt+Enter von Treffer zu Treffer
 * (eingeklappte Kategorien werden dabei aufgeklappt). Die Suche gilt nur für die Ansicht und
 * wird nicht gespeichert.
 */
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { isCollapsed, setCollapsed, state } from './core.js';
import { $ } from './dom.js';
import { scheduleLines } from './lines.js';
import { renderCategoryNav, renderMatrix } from './render-matrix.js';

let searchQuery = '';
/** Position des aktuellen Treffers in `hits`, `-1` = noch keiner angesprungen. */
let searchIndex = -1;

/** Treffer der aktuellen Suche oder `null`, wenn nicht gesucht wird. */
export function searchResult() {
  return searchQuery.trim() ? Model.search(state, searchQuery) : null;
}

/**
 * Klassen einer Matrixzelle während der Suche.
 * @param {ReturnType<typeof Model.search> | null} found
 * @param {string} pid @param {string | null} oid `null` = Parameterzelle
 */
export function searchClass(found, pid, oid) {
  if (!found) return '';
  const hit = oid ? found.options.has(oid) : found.hits.some(x => x.pid === pid && x.oid === null);
  if (hit) return ' is-match';
  return found.params.has(pid) ? '' : ' is-dim';
}

/** Anzahl der Treffer bzw. Position anzeigen und die Pfeile freigeben. */
function updateSearchStatus(found = searchResult()) {
  const n = found ? found.hits.length : 0;
  const status = $('#searchCount');
  status.textContent = !found ? '' : (n ? Texts.search.count(searchIndex < 0 ? null : searchIndex + 1, n) : Texts.search.none);
  status.classList.toggle('is-none', !!found && !n);
  $('#searchPrev').disabled = !n;
  $('#searchNext').disabled = !n;
}

/** Suchtext übernehmen und Markierungen aktualisieren. @param {string} value */
function setSearch(value) {
  searchQuery = value;
  searchIndex = -1;
  renderMatrix();
  renderCategoryNav();
  updateSearchStatus();
  scheduleLines();
}

/** Zum nächsten (`+1`) bzw. vorherigen (`-1`) Treffer springen. @param {number} delta */
function stepSearch(delta) {
  const found = searchResult();
  if (!found || !found.hits.length) return;
  const n = found.hits.length;
  searchIndex = searchIndex < 0 ? (delta > 0 ? 0 : n - 1) : (searchIndex + delta + n) % n;
  const hit = found.hits[searchIndex];
  const p = state.parameters.find(x => x.id === hit.pid);
  if (p && state.categories.length && isCollapsed(p.categoryId)) {
    setCollapsed(p.categoryId, false);
    renderCategoryNav();
  }
  renderMatrix();
  scheduleLines();
  updateSearchStatus(found);
  const el = $('.is-current-match', $('#matrix'));
  if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' });
}

/** Aktuellen Treffer nach dem Rendern der Matrix kennzeichnen. */
export function markCurrentMatch(found) {
  if (!found || searchIndex < 0 || searchIndex >= found.hits.length) return;
  const { pid, oid } = found.hits[searchIndex];
  const sel = oid ? `[data-oid="${CSS.escape(oid)}"]` : `[data-pid="${CSS.escape(pid)}"]`;
  const el = $(sel, $('#matrix'));
  if (el) el.classList.add('is-current-match');
}

export function initSearch() {
  const input = $('#matrixSearch');
  input.addEventListener('input', () => setSearch(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      stepSearch(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      input.value = '';
      setSearch('');
    }
  });
  $('#searchNext').addEventListener('click', () => stepSearch(1));
  $('#searchPrev').addEventListener('click', () => stepSearch(-1));
  updateSearchStatus();
}
