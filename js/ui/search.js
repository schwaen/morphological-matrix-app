/*
 * Suche in der Matrix: markiert Parameter und Ausprägungen, deren Text die Eingabe enthält,
 * blendet Zeilen ohne Treffer ab und springt mit Enter / Umschalt+Enter von Treffer zu Treffer
 * (eingeklappte Kategorien werden dabei aufgeklappt). Die Suche gilt nur für die Ansicht und
 * wird nicht gespeichert. Suchtext und aktueller Treffer sind Signale; die Matrix liest sie.
 */
import { effect, signal } from '@preact/signals';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { isCollapsed, revision, setCollapsed, state } from './core.js';
import { $ } from './dom.js';
import { render } from './render-panels.jsx';

const searchQuery = signal('');
/** Position des aktuellen Treffers in `hits`, `-1` = noch keiner angesprungen. */
const searchIndex = signal(-1);

/** Treffer der aktuellen Suche oder `null`, wenn nicht gesucht wird. */
export function searchResult() {
  return searchQuery.value.trim() ? Model.search(state, searchQuery.value) : null;
}

/** Aktueller Treffer (nach Enter bzw. den Pfeilen) oder `null`. @param {ReturnType<typeof Model.search> | null} found */
export function currentMatch(found) {
  const i = searchIndex.value;
  return found && i >= 0 && i < found.hits.length ? found.hits[i] : null;
}

/**
 * Klassen einer Matrixzelle während der Suche.
 * @param {ReturnType<typeof Model.search> | null} found
 * @param {string} pid @param {string | null} oid `null` = Parameterzelle
 */
export function searchClass(found, pid, oid) {
  if (!found) return '';
  const current = currentMatch(found);
  const isCurrent = !!current && current.pid === pid && current.oid === oid;
  const hit = oid ? found.options.has(oid) : found.hits.some(x => x.pid === pid && x.oid === null);
  if (hit) return isCurrent ? ' is-match is-current-match' : ' is-match';
  return found.params.has(pid) ? '' : ' is-dim';
}

/** Anzahl der Treffer bzw. Position anzeigen und die Pfeile freigeben (statische Elemente in index.html). */
function updateSearchStatus() {
  revision.value; // Treffer ändern sich auch mit der Matrix
  const found = searchResult();
  const n = found ? found.hits.length : 0;
  const i = searchIndex.value;
  const status = $('#searchCount');
  status.textContent = !found ? '' : (n ? Texts.search.count(i < 0 ? null : i + 1, n) : Texts.search.none);
  status.classList.toggle('is-none', !!found && !n);
  $('#searchPrev').disabled = !n;
  $('#searchNext').disabled = !n;
}

/** Suchtext übernehmen. @param {string} value */
function setSearch(value) {
  searchQuery.value = value;
  searchIndex.value = -1;
  render();
}

/** Zum nächsten (`+1`) bzw. vorherigen (`-1`) Treffer springen. @param {number} delta */
function stepSearch(delta) {
  const found = searchResult();
  if (!found || !found.hits.length) return;
  const n = found.hits.length;
  const i = searchIndex.value;
  searchIndex.value = i < 0 ? (delta > 0 ? 0 : n - 1) : (i + delta + n) % n;
  const hit = found.hits[searchIndex.value];
  const p = state.parameters.find(x => x.id === hit.pid);
  if (p && state.categories.length && isCollapsed(p.categoryId)) setCollapsed(p.categoryId, false);
  render();
  const el = $('.is-current-match', $('#matrix'));
  if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' });
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
  effect(updateSearchStatus);
}
