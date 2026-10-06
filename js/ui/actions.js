/*
 * Aktionen der Oberfläche: alle Änderungen an Parametern, Ausprägungen, Kategorien,
 * Konzepten und Einstellungen. Jede strukturelle Änderung läuft über `mutate()`.
 */
'use strict';

/** Auswahlwert „neue Kategorie anlegen“ im Kategorie-Auswahlfeld eines Parameters. */
const NEW_CATEGORY = '__new';

// ---------- Parameter ----------

/** @param {string | null} [categoryId] */
function addParameter(categoryId = null) {
  const p = Model.newParameter(categoryId);
  pendingFocus = `param:${p.id}`;
  if (categoryId) setCollapsed(categoryId, false);
  mutate(m => {
    m.parameters.push(p);
    Model.resort(m);
  });
}

function moveParameter(index, delta) {
  mutate(m => {
    const [p] = m.parameters.splice(index, 1);
    m.parameters.splice(index + delta, 0, p);
  });
}

function deleteParameter(pid) {
  const p = state.parameters.find(x => x.id === pid);
  mutate(m => {
    m.parameters = m.parameters.filter(x => x.id !== pid);
    m.concepts.forEach(c => { delete c.selections[pid]; });
  });
  toast(`Parameter „${Model.nameOrUnnamed(p)}“ gelöscht.`, true);
}

// ---------- Ausprägungen ----------

function addOption(pid, afterIndex) {
  const o = Model.newOption();
  pendingFocus = `opt:${o.id}`;
  mutate(m => {
    const p = m.parameters.find(x => x.id === pid);
    const at = afterIndex == null ? p.options.length : afterIndex + 1;
    p.options.splice(at, 0, o);
  });
}

/** Ausprägung innerhalb ihres Parameters nach links (−1) oder rechts (+1) verschieben. */
function moveOption(pid, index, delta) {
  const p = state.parameters.find(x => x.id === pid);
  const target = index + delta;
  if (!p || target < 0 || target >= p.options.length) return;
  const focused = /** @type {HTMLElement | null} */ (document.activeElement);
  pendingFocus = focused && focused.dataset.fid === `opt:${p.options[index].id}`
    ? `opt:${p.options[index].id}` : null;
  mutate(m => {
    const opts = m.parameters.find(x => x.id === pid).options;
    const [o] = opts.splice(index, 1);
    opts.splice(target, 0, o);
  });
}

function deleteOption(pid, oid) {
  mutate(m => {
    const p = m.parameters.find(x => x.id === pid);
    p.options = p.options.filter(o => o.id !== oid);
    m.concepts.forEach(c => { if (c.selections[pid] === oid) delete c.selections[pid]; });
  });
}

// ---------- Kategorien ----------

function addCategory() {
  const k = { id: Util.uid(), name: `Kategorie ${state.categories.length + 1}`, color: Model.nextCategoryColor(state.categories) };
  pendingFocus = `cat:${k.id}`;
  if (prefs.mode !== 'edit') setPref('mode', 'edit');
  mutate(m => { m.categories.push(k); });
}

function moveCategory(index, delta) {
  mutate(m => {
    const [k] = m.categories.splice(index, 1);
    m.categories.splice(index + delta, 0, k);
    Model.resort(m);
  });
}

function deleteCategory(cid) {
  const k = Model.categoryById(state, cid);
  mutate(m => {
    m.categories = m.categories.filter(x => x.id !== cid);
    m.parameters.forEach(p => { if (p.categoryId === cid) p.categoryId = null; });
    Model.resort(m);
  });
  toast(`Kategorie „${Model.nameOrUnnamed(k)}“ gelöscht – ihre Parameter bleiben erhalten.`, true);
}

/** @param {string} pid @param {string} cid Kategorie-ID, '' (ohne) oder NEW_CATEGORY */
function setParameterCategory(pid, cid) {
  if (cid === NEW_CATEGORY) {
    const name = window.prompt('Name der neuen Kategorie:', `Kategorie ${state.categories.length + 1}`);
    if (name == null) { renderMatrix(); return; } // Auswahlfeld zurücksetzen
    const k = { id: Util.uid(), name: name.trim(), color: Model.nextCategoryColor(state.categories) };
    mutate(m => {
      m.categories.push(k);
      m.parameters.find(p => p.id === pid).categoryId = k.id;
      Model.resort(m);
    });
    return;
  }
  if (cid) setCollapsed(cid, false);
  mutate(m => {
    m.parameters.find(p => p.id === pid).categoryId = cid || null;
    Model.resort(m);
  });
}

/** @param {string | null} cid */
function toggleCategory(cid) {
  setCollapsed(cid, !isCollapsed(cid));
  renderMatrix();
  renderCategoryNav();
  scheduleLines();
}

function setAllCollapsed(value) {
  for (const g of Model.categoryGroups(state)) setCollapsed(g.cat ? g.cat.id : null, value);
  renderMatrix();
  renderCategoryNav();
  scheduleLines();
}

/** Kategorie aufklappen und dorthin scrollen. @param {string | null} cid */
function jumpToCategory(cid) {
  if (isCollapsed(cid)) toggleCategory(cid);
  const band = document.querySelector(`[data-cat-band="${CSS.escape(collapseKey(cid))}"]`);
  if (band) band.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Konzepte ----------

/** Aktives Konzept (legt bei Bedarf eines an) – nur innerhalb von `mutate()` verwenden. @param {Matrix} m */
function ensureActiveConcept(m) {
  let c = m.concepts.find(x => x.id === m.activeConceptId);
  if (!c) {
    c = Model.newConcept(m);
    m.concepts.push(c);
    m.activeConceptId = c.id;
  }
  return c;
}

function toggleSelection(pid, oid) {
  mutate(m => {
    const c = ensureActiveConcept(m);
    if (c.selections[pid] === oid) delete c.selections[pid];
    else c.selections[pid] = oid;
  });
}

function addConcept() {
  const c = Model.newConcept(state);
  mutate(m => {
    m.concepts.push(c);
    m.activeConceptId = c.id;
  });
  if (prefs.mode !== 'select') setMode('select');
}

function duplicateConcept(cid) {
  mutate(m => {
    const idx = m.concepts.findIndex(x => x.id === cid);
    const src = m.concepts[idx];
    const copy = { ...Model.newConcept(m, `${src.name} (Kopie)`), selections: { ...src.selections } };
    m.concepts.splice(idx + 1, 0, copy);
    m.activeConceptId = copy.id;
  });
}

function deleteConcept(cid) {
  const c = state.concepts.find(x => x.id === cid);
  mutate(m => {
    const idx = m.concepts.findIndex(x => x.id === cid);
    m.concepts.splice(idx, 1);
    if (m.activeConceptId === cid) {
      const next = m.concepts[Math.min(idx, m.concepts.length - 1)];
      m.activeConceptId = next ? next.id : null;
    }
  });
  toast(`Konzept „${Model.nameOrUnnamed(c)}“ gelöscht.`, true);
}

/** Aktives Konzept wechseln (Ansichtsänderung, kein Verlaufseintrag). */
function setActiveConcept(cid) {
  if (state.activeConceptId === cid) return;
  state.activeConceptId = cid;
  save();
  render();
}

/** Wie `setActiveConcept`, aber ohne die Konzeptliste (und damit das fokussierte Feld) neu zu erzeugen. */
function setActiveConceptLight(cid) {
  if (state.activeConceptId === cid) return;
  state.activeConceptId = cid;
  save();
  $$('.concept').forEach(li => li.classList.toggle('is-active', li.dataset.cid === cid));
  renderMatrix();
  refreshLight();
}

function randomizeActive() {
  if (!state.parameters.some(p => p.options.length)) {
    toast('Es gibt noch keine Ausprägungen.');
    return;
  }
  mutate(m => {
    const c = ensureActiveConcept(m);
    c.selections = {};
    for (const p of m.parameters) {
      if (p.options.length) c.selections[p.id] = p.options[Math.floor(Math.random() * p.options.length)].id;
    }
  });
  if (prefs.mode !== 'select') setMode('select');
}

function clearActive() {
  const c = activeConcept();
  if (!c || !Object.keys(c.selections).length) return;
  mutate(m => { m.concepts.find(x => x.id === m.activeConceptId).selections = {}; });
}

/** Konzept nach einer Strategie aus `Evaluation.GENERATORS` erstellen. @param {string} key */
function generateConcept(key) {
  const gen = Evaluation.GENERATORS[key];
  if (!gen || !gen.available(state)) return;
  const { selections, skipped, error } = gen.build(state);
  if (error || !selections || !Object.keys(selections).length) {
    toast(`Kein Konzept erstellt. ${error || `Bitte zuerst ${gen.missing} an den Ausprägungen erfassen.`}`);
    return;
  }
  const existing = state.concepts.find(c => Model.sameSelections(c.selections, selections));
  if (existing) {
    setActiveConcept(existing.id);
    if (prefs.mode !== 'select') setMode('select');
    toast(`Diese Kombination („${gen.label}“) gibt es bereits als Konzept „${Model.nameOrUnnamed(existing)}“ – es wurde ausgewählt.`);
    return;
  }
  const c = { ...Model.newConcept(state, gen.label), selections };
  mutate(m => {
    m.concepts.push(c);
    m.activeConceptId = c.id;
  });
  if (prefs.mode !== 'select') setMode('select');
  toast(skipped
    ? `Konzept „${c.name}“ erstellt – ${skipped} ${skipped === 1 ? 'Parameter blieb' : 'Parameter blieben'} ohne Auswahl, da dort ${gen.missing} fehlt.`
    : `Konzept „${c.name}“ erstellt.`, true);
}

// ---------- Bewertungseinstellungen ----------

/** @template {keyof MatrixSettings} K @param {K} key @param {MatrixSettings[K]} value */
function changeSetting(key, value) {
  if (state.settings[key] === value) return;
  mutate(m => { m.settings[key] = value; });
}

/** Neue Nutzwert-Skala; vorhandene Werte werden auf Wunsch proportional umgerechnet. */
function changeScale(max) {
  const oldMax = state.settings.utilityMax;
  if (max === oldMax) return;
  const hasScores = state.parameters.some(p => p.options.some(o => o.score != null));
  const rescale = hasScores && window.confirm(
    `Vorhandene Nutzwerte von der Skala 0–${oldMax} auf 0–${max} umrechnen?\n\n`
    + 'OK: umrechnen (z. B. wird 7 von 10 zu 3,5 von 5)\nAbbrechen: Werte unverändert lassen');
  mutate(m => {
    m.settings.utilityMax = max;
    if (!rescale) return;
    for (const p of m.parameters) {
      for (const o of p.options) {
        if (o.score != null) o.score = Math.round((o.score / oldMax) * max * 100) / 100;
      }
    }
  });
}
