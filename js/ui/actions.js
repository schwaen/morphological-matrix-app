/*
 * Aktionen der Oberfläche: verbinden Bedienelemente mit den Änderungen aus `Ops` (js/ops.js).
 * Jede strukturelle Änderung läuft über `mutate()`; hier bleibt nur, was zur Oberfläche gehört
 * (Fokus, Hinweise, Rückfragen, Ansichtswechsel).
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
  mutate(m => Ops.addParameter(m, p));
}

function moveParameter(index, delta) {
  mutate(m => Ops.moveParameter(m, index, delta));
}

function deleteParameter(pid) {
  const p = state.parameters.find(x => x.id === pid);
  mutate(m => Ops.deleteParameter(m, pid));
  toast(Texts.toast.parameterDeleted(Model.nameOrUnnamed(p)), true);
}

// ---------- Ausprägungen ----------

function addOption(pid, afterIndex) {
  const o = Model.newOption();
  pendingFocus = `opt:${o.id}`;
  mutate(m => Ops.addOption(m, pid, o, afterIndex));
}

/** Ausprägung innerhalb ihres Parameters nach links (−1) oder rechts (+1) verschieben. */
function moveOption(pid, index, delta) {
  const p = state.parameters.find(x => x.id === pid);
  const target = index + delta;
  if (!p || target < 0 || target >= p.options.length) return;
  const focused = /** @type {HTMLElement | null} */ (document.activeElement);
  pendingFocus = focused && focused.dataset.fid === `opt:${p.options[index].id}`
    ? `opt:${p.options[index].id}` : null;
  mutate(m => Ops.moveOption(m, pid, index, delta));
}

function deleteOption(pid, oid) {
  mutate(m => Ops.deleteOption(m, pid, oid));
}

// ---------- Kategorien ----------

function addCategory() {
  const k = { id: Util.uid(), name: Texts.fallback.category(state.categories.length + 1), color: Model.nextCategoryColor(state.categories) };
  pendingFocus = `cat:${k.id}`;
  if (prefs.mode !== 'edit') setPref('mode', 'edit');
  mutate(m => Ops.addCategory(m, k));
}

function moveCategory(index, delta) {
  mutate(m => Ops.moveCategory(m, index, delta));
}

function deleteCategory(cid) {
  const k = Model.categoryById(state, cid);
  mutate(m => Ops.deleteCategory(m, cid));
  toast(Texts.toast.categoryDeleted(Model.nameOrUnnamed(k)), true);
}

/** @param {string} pid @param {string} cid Kategorie-ID, '' (ohne) oder NEW_CATEGORY */
function setParameterCategory(pid, cid) {
  if (cid === NEW_CATEGORY) {
    const name = window.prompt(Texts.prompt.newCategory, Texts.fallback.category(state.categories.length + 1));
    if (name == null) { renderMatrix(); return; } // Auswahlfeld zurücksetzen
    const k = { id: Util.uid(), name: name.trim(), color: Model.nextCategoryColor(state.categories) };
    mutate(m => {
      Ops.addCategory(m, k);
      Ops.setParameterCategory(m, pid, k.id);
    });
    return;
  }
  if (cid) setCollapsed(cid, false);
  mutate(m => Ops.setParameterCategory(m, pid, cid || null));
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

function toggleSelection(pid, oid) {
  mutate(m => Ops.toggleSelection(m, pid, oid));
}

function addConcept() {
  const c = Model.newConcept(state);
  mutate(m => Ops.addConcept(m, c));
  if (prefs.mode !== 'select') setMode('select');
}

function duplicateConcept(cid) {
  mutate(m => Ops.duplicateConcept(m, cid));
}

function deleteConcept(cid) {
  const c = state.concepts.find(x => x.id === cid);
  mutate(m => Ops.deleteConcept(m, cid));
  toast(Texts.toast.conceptDeleted(Model.nameOrUnnamed(c)), true);
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
    toast(Texts.toast.noOptions);
    return;
  }
  mutate(m => Ops.randomizeActive(m));
  if (prefs.mode !== 'select') setMode('select');
}

function clearActive() {
  const c = activeConcept();
  if (!c || !Object.keys(c.selections).length) return;
  mutate(m => Ops.clearActive(m));
}

/** Konzept nach einer Strategie aus `Evaluation.GENERATORS` erstellen. @param {string} key */
function generateConcept(key) {
  const gen = Evaluation.GENERATORS[key];
  if (!gen || !gen.available(state)) return;
  const { selections, skipped, error } = gen.build(state);
  if (error || !selections || !Object.keys(selections).length) {
    toast(Texts.toast.notGenerated(error || Texts.toast.missingValues(gen.missing)));
    return;
  }
  const existing = state.concepts.find(c => Model.sameSelections(c.selections, selections));
  if (existing) {
    setActiveConcept(existing.id);
    if (prefs.mode !== 'select') setMode('select');
    toast(Texts.toast.generatedExists(gen.label, Model.nameOrUnnamed(existing)));
    return;
  }
  const c = { ...Model.newConcept(state, gen.label), selections };
  mutate(m => Ops.addConcept(m, c));
  if (prefs.mode !== 'select') setMode('select');
  toast(skipped ? Texts.toast.generatedPartial(c.name, skipped, gen.missing) : Texts.toast.generated(c.name), true);
}

// ---------- Bewertungseinstellungen ----------

/**
 * Priorität (MoSCoW) einer Ausprägung setzen; dieselbe Priorität erneut gewählt entfernt sie.
 * @param {string} pid @param {string} oid @param {MatrixPriority} priority
 */
function setPriority(pid, oid, priority) {
  mutate(m => Ops.togglePriority(m, pid, oid, priority));
}

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
  const rescale = hasScores && window.confirm(Texts.prompt.rescale(oldMax, max));
  mutate(m => Ops.changeScale(m, max, rescale));
}
