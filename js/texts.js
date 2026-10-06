/*
 * Texts – alle Texte, die das JavaScript anzeigt (Hinweise, Beschriftungen, Fehlermeldungen,
 * Export-Spaltenköpfe). Statische Texte der Seite stehen in index.html.
 * Gesammelt an einer Stelle, damit Formulierungen einheitlich bleiben und eine spätere
 * Übersetzung nur diese Datei (und index.html) betrifft. Stellt den Namensraum `Texts` bereit.
 */
'use strict';

const Texts = (() => {
  /** Einzahl/Mehrzahl: `plural(1, 'Konzept', 'Konzepte')` → „1 Konzept“. */
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  /** Anführungszeichen wie in der Oberfläche üblich. */
  const q = s => `„${s}“`;

  return {
    plural,

    app: {
      /** @param {string} title */
      documentTitle: title => (title ? `${title} – Morphologische Matrix` : 'Morphologische Matrix'),
    },

    // Ersatznamen für leere Felder – Anzeige und Export verwenden dieselben
    fallback: {
      unnamed: 'Unbenannt',
      unnamedMatrix: 'Unbenannte Matrix',
      unnamedConcept: 'Unbenanntes Konzept',
      noCategory: 'Ohne Kategorie',
      matrixTitle: 'Morphologische Matrix',
      newMatrixTitle: 'Neue morphologische Matrix',
      parameter: n => `Parameter ${n}`,
      option: n => `Ausprägung ${n}`,
      /** Leere Ausprägung in Listen, Vergleich und Export */
      emptyOption: n => `(Ausprägung ${n})`,
      concept: n => `Konzept ${n}`,
      category: n => `Kategorie ${n}`,
      copyOf: name => `${name} (Kopie)`,
    },

    errors: {
      invalidFormat: 'Ungültiges Dateiformat: „parameters“ fehlt.',
      newerFormat: (version, supported) =>
        `Die Daten stammen aus einer neueren Version der App (Format ${version}, unterstützt bis ${supported}).`,
      fileUnreadable: 'Datei konnte nicht gelesen werden.',
      fileInvalid: message => `Datei konnte nicht gelesen werden: ${message}`,
      shareInvalid: 'Der geteilte Link ist ungültig.',
      storageFull: 'Speichern im Browser nicht möglich – bitte als JSON sichern.',
      docMissing: 'Diese Matrix existiert nicht mehr.',
    },

    toast: {
      undo: 'Rückgängig',
      parameterDeleted: name => `Parameter ${q(name)} gelöscht.`,
      categoryDeleted: name => `Kategorie ${q(name)} gelöscht – ihre Parameter bleiben erhalten.`,
      conceptDeleted: name => `Konzept ${q(name)} gelöscht.`,
      noOptions: 'Es gibt noch keine Ausprägungen.',
      newMatrix: 'Neue Matrix angelegt.',
      exampleOpened: name => `Beispiel ${q(name)} als neue Matrix geöffnet.`,
      opened: title => `${q(title)} geöffnet.`,
      sharedOpened: title => `Geteilte Matrix ${q(title)} als neue Matrix geöffnet.`,
      linkCopied: 'Link in die Zwischenablage kopiert.',
      generated: name => `Konzept ${q(name)} erstellt.`,
      generatedPartial: (name, skipped, missing) =>
        `Konzept ${q(name)} erstellt – ${skipped} ${skipped === 1 ? 'Parameter blieb' : 'Parameter blieben'} ohne Auswahl, da dort ${missing} fehlt.`,
      generatedExists: (label, name) =>
        `Diese Kombination (${q(label)}) gibt es bereits als Konzept ${q(name)} – es wurde ausgewählt.`,
      notGenerated: reason => `Kein Konzept erstellt. ${reason}`,
      missingValues: missing => `Bitte zuerst ${missing} an den Ausprägungen erfassen.`,
    },

    prompt: {
      newCategory: 'Name der neuen Kategorie:',
      shareLink: 'Link zum Teilen (kopieren mit Strg+C):',
      rescale: (oldMax, max) => `Vorhandene Nutzwerte von der Skala 0–${oldMax} auf 0–${max} umrechnen?\n\n`
        + 'OK: umrechnen (z. B. wird 7 von 10 zu 3,5 von 5)\nAbbrechen: Werte unverändert lassen',
      deleteMatrix: title => `Matrix ${q(title)} endgültig löschen?`,
    },

    hint: {
      edit: 'Tipp: Mit Enter springen Sie zur nächsten Ausprägung bzw. legen eine neue an. Zum Kombinieren oben auf „Kombinieren“ wechseln.',
      select: name => `Klicken Sie je Parameter auf eine Ausprägung, um sie dem Konzept ${q(name)} zuzuordnen. Erneuter Klick hebt die Auswahl auf.`,
      noConcept: 'Legen Sie ein Konzept an und wählen Sie dann je Parameter eine Ausprägung.',
    },

    stats: {
      parameters: 'Parameter',
      options: n => (n === 1 ? 'Ausprägung' : 'Ausprägungen'),
      combinations: one => (one ? 'mögliche Kombination' : 'mögliche Kombinationen'),
      /** Zahlwörter für sehr große Anzahlen (lange Skala), Schlüssel = Zehnerpotenz */
      bigUnits: {
        12: 'Billionen', 15: 'Billiarden', 18: 'Trillionen', 21: 'Trilliarden',
        24: 'Quadrillionen', 27: 'Quadrilliarden', 30: 'Quintillionen', 33: 'Quintilliarden',
      },
      approx: (value, unit) => `≈ ${value} ${unit}`,
      approxPower: (value, power) => `≈ ${value} · 10${String(power).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])}`,
      exact: n => `Genau: ${n}`,
      concepts: n => (n === 1 ? 'Konzept' : 'Konzepte'),
    },

    matrix: {
      label: 'Morphologische Matrix',
      emptyEdit: 'Noch keine Parameter – fügen Sie unten den ersten hinzu.',
      emptySelect: 'Noch keine Parameter. Wechseln Sie in den Modus „Bearbeiten“, um die Matrix aufzubauen.',
      parameterName: n => `Name von Parameter ${n}`,
      optionField: (param, n) => `${param}: Ausprägung ${n}`,
      optionCount: n => plural(n, 'Ausprägung', 'Ausprägungen'),
      weight: 'Gewicht',
      weightOf: param => `Gewichtung von ${param}`,
      weightShare: percent => `Gewicht\u00a0${percent}`,
      moveUp: 'Nach oben verschieben',
      moveDown: 'Nach unten verschieben',
      moveLeft: 'Nach links verschieben (Alt+←)',
      moveRight: 'Nach rechts verschieben (Alt+→)',
      deleteParameter: 'Parameter löschen',
      deleteOption: 'Ausprägung löschen',
      addOption: 'Ausprägung hinzufügen',
      addOptionTo: param => `Ausprägung zu ${param} hinzufügen`,
      costPlaceholder: 'Kosten',
      costOf: option => `Kosten von ${option}`,
      utilityUnit: 'NW',
      utilityUnitTitle: 'Nutzwert (Erfüllungsgrad)',
      utilityOf: (option, max) => `Nutzwert von ${option} (0 bis ${max})`,
      utilityShort: value => `NW ${value}`,
      selectedIn: names => `Gewählt in: ${names}`,
    },

    category: {
      select: param => `Kategorie von ${param}`,
      selectTitle: 'Kategorie',
      newOption: '+ Neue Kategorie …',
      expand: 'Ausklappen',
      collapse: 'Einklappen',
      toggle: (name, collapsed) => `${name} ${collapsed ? 'ausklappen' : 'einklappen'}`,
      color: name => `Farbe von ${name}`,
      changeColor: 'Farbe ändern',
      namePlaceholder: 'Kategorie',
      nameLabel: 'Name der Kategorie',
      count: n => `${n} Parameter`,
      progress: (picked, total) => `${picked}/${total} gewählt`,
      progressTitle: concept => `Auswahl im Konzept ${q(concept)}`,
      addParameter: 'Parameter',
      moveUp: 'Kategorie nach oben',
      moveDown: 'Kategorie nach unten',
      delete: 'Kategorie löschen (Parameter bleiben erhalten)',
      jumpTo: name => `Zu ${q(name)} springen`,
      expandAll: 'Alle ausklappen',
      collapseAll: 'Alle einklappen',
    },

    concept: {
      color: name => `Farbe von ${name}`,
      changeColor: 'Farbe ändern',
      nameLabel: n => `Name von Konzept ${n}`,
      duplicate: 'Konzept duplizieren',
      delete: 'Konzept löschen',
      progressTitle: (filled, total) => `${filled} von ${total} Parametern gewählt`,
      none: 'Noch keine Konzepte.',
    },

    // Priorität nach MoSCoW
    moscow: {
      levels: {
        must: { short: 'M', label: 'Must have' },
        should: { short: 'S', label: 'Should have' },
        could: { short: 'C', label: 'Could have' },
        wont: { short: 'W', label: "Won't have" },
      },
      groupLabel: 'Priorität',
      short: 'Prio',
      setLabel: (level, option) => `Priorität von ${option}: ${level}`,
      wontHint: "Won't have – bewusst ausgeschlossen; wird von automatischen Konzepten nie gewählt",
      profileTitle: 'Gewählte Ausprägungen je Priorität',
      none: 'ohne',
      wontNote: n => `enthält ${n} × Won't`,
    },

    summary: {
      noConcept: 'Kein Konzept ausgewählt.',
      noParameters: 'Die Matrix enthält noch keine Parameter.',
      notSelected: 'nicht gewählt',
      totalCost: 'Gesamtkosten',
      utility: 'Nutzwert',
      utilityValue: (value, max) => `${value} / ${max}`,
      missing: n => `${n} ${n === 1 ? 'Wert fehlt' : 'Werte fehlen'}`,
    },

    compare: {
      parameter: 'Parameter',
      conceptCount: n => plural(n, 'Konzept', 'Konzepte'),
      totalCost: 'Gesamtkosten',
      utility: max => `Nutzwert (max. ${max})`,
      priceValue: 'Preis-Leistung',
      priceValueNote: 'Kosten je Nutzwertpunkt',
      priceValueTitle: 'Gesamtkosten geteilt durch Nutzwert – je niedriger, desto besser',
      priority: 'Priorität (MoSCoW)',
    },

    evaluation: {
      incomplete: 'Nicht berechenbar: Kosten oder Nutzwerte sind unvollständig.',
      zeroUtility: 'Nicht berechenbar: Der Nutzwert ist 0.',
      needsAllValues: 'Dafür müssen in jedem Parameter Ausprägungen mit Kosten und Nutzwert gepflegt sein.',
      zeroWeights: 'Die Summe der Gewichte ist 0.',
      allScoresZero: 'Alle gepflegten Nutzwerte sind 0.',
      generators: {
        'max-utility': { label: 'Höchster Nutzwert', missing: 'Nutzwert' },
        'min-utility': { label: 'Geringster Nutzwert', missing: 'Nutzwert' },
        'min-cost': { label: 'Geringste Kosten', missing: 'Kosten' },
        'max-cost': { label: 'Höchste Kosten', missing: 'Kosten' },
        'best-value': { label: 'Beste Preis-Leistung', missing: 'Kosten und Nutzwert' },
        'moscow-must': { label: 'MVP (Must-haves)', missing: 'die Priorität „Must“' },
        'moscow-should': { label: 'Standard (Should-haves)', missing: 'die Priorität „Should“' },
        'moscow-could': { label: 'Premium (Could-haves)', missing: 'die Priorität „Could“' },
      },
    },

    tabs: {
      label: 'Geöffnete Matrizen',
      titleLabel: 'Titel der Matrix',
      renameHint: 'Doppelklick zum Umbenennen',
      add: 'Matrix öffnen oder neu anlegen',
      close: 'Tab schließen',
      closeNamed: title => `${q(title)} schließen`,
      external: 'In einem anderen Browser-Tab geändert',
      newBlank: 'Neue leere Matrix',
      example: 'Beispiel öffnen …',
      importJson: 'JSON öffnen …',
      fromLibrary: 'Aus „Meine Matrizen“ öffnen …',
      recentlyClosed: 'Zuletzt geschlossen',
    },

    examples: {
      meta: (parameters, categories, concepts) => [
        `${parameters} Parameter`,
        categories ? plural(categories, 'Kategorie', 'Kategorien') : null,
        plural(concepts, 'Konzept', 'Konzepte'),
      ].filter(Boolean).join(' · '),
      open: 'Öffnen',
      empty: 'Es sind keine Beispiele eingebunden.',
    },

    library: {
      currentTab: 'aktiv',
      openTab: 'geöffnet',
      meta: (date, parameters, concepts) => `${date} · ${parameters} Parameter · ${plural(concepts, 'Konzept', 'Konzepte')}`,
      open: 'Öffnen',
      show: 'Anzeigen',
      delete: 'Matrix löschen',
      deleteOpen: 'Geöffnete Matrizen können nicht gelöscht werden – zuerst den Tab schließen',
    },

    // Spaltenköpfe des CSV-Exports
    csv: {
      title: 'Titel',
      description: 'Beschreibung',
      category: 'Kategorie',
      parameter: 'Parameter',
      option: n => `Ausprägung ${n}`,
      optionSingle: 'Ausprägung',
      weight: 'Gewicht',
      cost: currency => `Kosten (${currency})`,
      utility: max => `Nutzwert (0–${max})`,
      priority: 'Priorität (MoSCoW)',
      concept: 'Konzept',
      totalCost: currency => `Gesamtkosten (${currency})`,
      utilityTotal: 'Nutzwert',
      priceValue: currency => `Kosten je Nutzwertpunkt (${currency})`,
    },
  };
})();
