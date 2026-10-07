/*
 * Ops – strukturelle Änderungen an einer Matrix: Parameter, Ausprägungen, Kategorien,
 * Konzepte und Bewertungseinstellungen. Reine Funktionen ohne DOM und ohne globalen Zustand:
 * Sie ändern die übergebene Matrix direkt (passend zu `mutate()` in der Oberfläche) und geben
 * zurück, ob bzw. was sich geändert hat. Stellt den globalen Namensraum `Ops` bereit.
 *
 * Invariante: `m.parameters` bleibt nach Kategorien gruppiert sortiert (siehe `Model.resort`).
 */
'use strict';

const Ops = (() => {
  /** @param {Matrix} m @param {string} pid */
  const param = (m, pid) => m.parameters.find(p => p.id === pid) || null;

  /** Element in einer Liste verschieben; `false`, wenn das Ziel außerhalb liegt. @param {any[]} list @param {number} index @param {number} delta */
  function move(list, index, delta) {
    const target = index + delta;
    if (index < 0 || index >= list.length || target < 0 || target >= list.length) return false;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    return true;
  }

  // ---------- Parameter ----------

  /** @param {Matrix} m @param {MatrixParameter} p */
  function addParameter(m, p) {
    m.parameters.push(p);
    Model.resort(m);
  }

  /**
   * Innerhalb der Anzeige-Reihenfolge verschieben (die Oberfläche bietet das nur innerhalb einer Gruppe an).
   * @param {Matrix} m @param {number} index @param {number} delta
   */
  const moveParameter = (m, index, delta) => move(m.parameters, index, delta);

  /** Parameter löschen; Auswahlen der Konzepte für ihn entfallen. @param {Matrix} m @param {string} pid */
  function deleteParameter(m, pid) {
    const before = m.parameters.length;
    const removed = new Set((param(m, pid) || { options: [] }).options.map(o => o.id));
    m.parameters = m.parameters.filter(p => p.id !== pid);
    m.concepts.forEach(c => { delete c.selections[pid]; });
    dropConstraints(m, removed);
    return m.parameters.length < before;
  }

  // ---------- Ausprägungen ----------

  /**
   * @param {Matrix} m @param {string} pid @param {MatrixOption} o
   * @param {number | null} [afterIndex] einfügen hinter dieser Position, sonst am Ende
   */
  function addOption(m, pid, o, afterIndex = null) {
    const p = param(m, pid);
    if (!p) return false;
    const at = afterIndex == null ? p.options.length : Math.min(afterIndex + 1, p.options.length);
    p.options.splice(at, 0, o);
    return true;
  }

  /**
   * Ausprägung innerhalb ihres Parameters verschieben (−1 links, +1 rechts).
   * @param {Matrix} m @param {string} pid @param {number} index @param {number} delta
   */
  function moveOption(m, pid, index, delta) {
    const p = param(m, pid);
    return !!p && move(p.options, index, delta);
  }

  /**
   * Ausprägung löschen; Konzepte, die sie gewählt hatten, verlieren diese Auswahl.
   * @param {Matrix} m @param {string} pid @param {string} oid
   */
  function deleteOption(m, pid, oid) {
    const p = param(m, pid);
    if (!p) return false;
    p.options = p.options.filter(o => o.id !== oid);
    m.concepts.forEach(c => { if (c.selections[pid] === oid) delete c.selections[pid]; });
    dropConstraints(m, new Set([oid]));
    return true;
  }

  /**
   * Priorität (MoSCoW) setzen; dieselbe Priorität erneut gewählt entfernt sie.
   * @param {Matrix} m @param {string} pid @param {string} oid @param {MatrixPriority} priority
   */
  function togglePriority(m, pid, oid, priority) {
    const p = param(m, pid);
    const o = p && p.options.find(x => x.id === oid);
    if (!o) return false;
    o.priority = o.priority === priority ? null : priority;
    return true;
  }

  // ---------- Verträglichkeiten ----------

  /** Paare entfernen, die eine der Ausprägungen enthalten. @param {Matrix} m @param {Set<string>} oids */
  function dropConstraints(m, oids) {
    m.constraints = m.constraints.filter(c => !oids.has(c.a) && !oids.has(c.b));
  }

  /**
   * Verträglichkeit eines Paars setzen; `null` = verträglich (Eintrag entfällt). Die Begründung
   * bleibt beim Wechsel zwischen bedingt und unverträglich erhalten.
   * @param {Matrix} m @param {string} a @param {string} b @param {MatrixConstraintType | null} type
   */
  function setConstraint(m, a, b, type) {
    const owner = Consistency.paramOf(m);
    if (a === b || !owner.has(a) || !owner.has(b) || owner.get(a) === owner.get(b)) return false;
    const existing = Consistency.get(m, a, b);
    if (!type) {
      if (!existing) return false;
      m.constraints = m.constraints.filter(c => c !== existing);
      return true;
    }
    if (existing) {
      if (existing.type === type) return false;
      existing.type = type;
      return true;
    }
    m.constraints.push({ a: a < b ? a : b, b: a < b ? b : a, type, note: '' });
    return true;
  }

  // ---------- Kategorien ----------

  /** @param {Matrix} m @param {MatrixCategory} k */
  function addCategory(m, k) {
    m.categories.push(k);
  }

  /** Kategorie verschieben; ihre Parameter wandern mit. @param {Matrix} m @param {number} index @param {number} delta */
  function moveCategory(m, index, delta) {
    if (!move(m.categories, index, delta)) return false;
    Model.resort(m);
    return true;
  }

  /** Kategorie löschen; ihre Parameter bleiben erhalten (ohne Kategorie). @param {Matrix} m @param {string} cid */
  function deleteCategory(m, cid) {
    const before = m.categories.length;
    m.categories = m.categories.filter(k => k.id !== cid);
    m.parameters.forEach(p => { if (p.categoryId === cid) p.categoryId = null; });
    Model.resort(m);
    return m.categories.length < before;
  }

  /** @param {Matrix} m @param {string} pid @param {string | null} cid `null` = ohne Kategorie */
  function setParameterCategory(m, pid, cid) {
    const p = param(m, pid);
    if (!p || (cid && !Model.categoryById(m, cid))) return false;
    p.categoryId = cid || null;
    Model.resort(m);
    return true;
  }

  // ---------- Konzepte ----------

  /** Aktives Konzept; legt bei Bedarf eines an. @param {Matrix} m @returns {MatrixConcept} */
  function ensureActiveConcept(m) {
    let c = m.concepts.find(x => x.id === m.activeConceptId);
    if (!c) {
      c = Model.newConcept(m);
      m.concepts.push(c);
      m.activeConceptId = c.id;
    }
    return c;
  }

  /**
   * Ausprägung für das aktive Konzept wählen bzw. die Auswahl wieder aufheben.
   * @param {Matrix} m @param {string} pid @param {string} oid
   */
  function toggleSelection(m, pid, oid) {
    const c = ensureActiveConcept(m);
    if (c.selections[pid] === oid) delete c.selections[pid];
    else c.selections[pid] = oid;
  }

  /** Konzept anhängen und aktiv setzen. @param {Matrix} m @param {MatrixConcept} c */
  function addConcept(m, c) {
    m.concepts.push(c);
    m.activeConceptId = c.id;
  }

  /**
   * Kopie direkt hinter dem Original einfügen und aktiv setzen.
   * @param {Matrix} m @param {string} cid @returns {MatrixConcept | null}
   */
  function duplicateConcept(m, cid) {
    const idx = m.concepts.findIndex(x => x.id === cid);
    if (idx < 0) return null;
    const src = m.concepts[idx];
    const copy = { ...Model.newConcept(m, Texts.fallback.copyOf(src.name)), note: src.note, selections: { ...src.selections } };
    m.concepts.splice(idx + 1, 0, copy);
    m.activeConceptId = copy.id;
    return copy;
  }

  /**
   * Konzept löschen; war es aktiv, wird der Nachfolger (sonst Vorgänger) aktiv.
   * @param {Matrix} m @param {string} cid
   */
  function deleteConcept(m, cid) {
    const idx = m.concepts.findIndex(x => x.id === cid);
    if (idx < 0) return false;
    m.concepts.splice(idx, 1);
    if (m.activeConceptId === cid) {
      const next = m.concepts[Math.min(idx, m.concepts.length - 1)];
      m.activeConceptId = next ? next.id : null;
    }
    return true;
  }

  /**
   * Aktives Konzept zufällig belegen (je Parameter mit Ausprägungen eine; bei Verträglichkeiten
   * nur verträgliche Kombinationen).
   * @param {Matrix} m @param {() => number} [random] für Tests austauschbar
   */
  function randomizeActive(m, random = Math.random) {
    const c = ensureActiveConcept(m);
    c.selections = {};
    if (m.constraints.some(x => x.type === 'excluded')) {
      c.selections = Consistency.randomCombination(m, random);
      return;
    }
    for (const p of m.parameters) {
      if (p.options.length) c.selections[p.id] = p.options[Math.floor(random() * p.options.length)].id;
    }
  }

  /** Auswahl des aktiven Konzepts leeren. @param {Matrix} m */
  function clearActive(m) {
    const c = m.concepts.find(x => x.id === m.activeConceptId);
    if (!c || !Object.keys(c.selections).length) return false;
    c.selections = {};
    return true;
  }

  // ---------- Bewertungseinstellungen ----------

  /**
   * Neue Nutzwert-Skala; vorhandene Werte auf Wunsch proportional umrechnen (2 Nachkommastellen).
   * @param {Matrix} m @param {MatrixSettings['utilityMax']} max @param {boolean} rescale
   */
  function changeScale(m, max, rescale) {
    const oldMax = m.settings.utilityMax;
    m.settings.utilityMax = max;
    if (!rescale || max === oldMax) return;
    for (const p of m.parameters) {
      for (const o of p.options) {
        if (o.score != null) o.score = Math.round((o.score / oldMax) * max * 100) / 100;
      }
    }
  }

  return {
    addParameter, moveParameter, deleteParameter,
    addOption, moveOption, deleteOption, togglePriority,
    addCategory, moveCategory, deleteCategory, setParameterCategory,
    setConstraint,
    ensureActiveConcept, toggleSelection, addConcept, duplicateConcept, deleteConcept, randomizeActive, clearActive,
    changeScale,
  };
})();
