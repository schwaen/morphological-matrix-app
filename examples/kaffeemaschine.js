/*
 * Beispiel „Kaffeemaschine“.
 * `data` hat dasselbe Format wie eine mit „Als JSON speichern“ exportierte Datei
 * (siehe docs/DATENFORMAT.md). Anleitung für weitere Beispiele: examples/README.md
 */
Examples.register({
  "id": "kaffeemaschine",
  "name": "Kaffeemaschine",
  "description": "Produktentwicklung eines Haushaltsgeräts mit Konzepten für Espresso, Outdoor und Smart Home. Kosten, Nutzwerte, Prioritäten (MoSCoW), einige Notizen und Verträglichkeiten sind hinterlegt – zum Ausprobieren unter „Bewertung“ einschalten.",
  "data": {
    "version": 5,
    "title": "Beispiel: Kaffeemaschine",
    "description": "Gesamtfunktion: Aus Wasser und Kaffee ein heißes Getränk zubereiten.",
    "settings": { "costs": false, "utility": false, "currency": "EUR", "utilityMax": 10, "moscow": false },
    "categories": [
      { "id": "k1", "name": "Brühsystem", "color": "#4f46e5" },
      { "id": "k2", "name": "Nutzung & Betrieb", "color": "#0891b2" }
    ],
    "parameters": [
      {
        "id": "p1",
        "name": "Wassererwärmung",
        "weight": 3,
        "categoryId": "k1",
        "options": [
          { "id": "p1o1", "text": "Durchlauferhitzer", "cost": 18, "score": 6, "priority": "must" },
          { "id": "p1o2", "text": "Boiler", "cost": 25, "score": 5, "priority": "wont" },
          { "id": "p1o3", "text": "Thermoblock", "cost": 22, "score": 8, "priority": "should", "note": "Heizt in ca. 30 s auf; Temperatur schwankt stärker als beim Boiler." },
          { "id": "p1o4", "text": "Induktion", "cost": 40, "score": 9, "priority": "could" }
        ]
      },
      {
        "id": "p2",
        "name": "Druckerzeugung",
        "note": "Bestimmt Crema-Qualität und Geräuschpegel.",
        "weight": 3,
        "categoryId": "k1",
        "options": [
          { "id": "p2o1", "text": "Schwerkraft", "cost": 2, "score": 3, "priority": "wont" },
          { "id": "p2o2", "text": "Vibrationspumpe", "cost": 12, "score": 7, "priority": "must", "note": "Bis 15 bar, aber hörbar laut – Standard bei Einstiegsgeräten." },
          { "id": "p2o3", "text": "Rotationspumpe", "cost": 45, "score": 9, "priority": "could" },
          { "id": "p2o4", "text": "Handhebel", "cost": 8, "score": 6, "priority": "wont" }
        ]
      },
      {
        "id": "p3",
        "name": "Kaffeezufuhr",
        "weight": 2,
        "categoryId": "k1",
        "options": [
          { "id": "p3o1", "text": "Pulver (lose)", "cost": 3, "score": 6, "priority": "must" },
          { "id": "p3o2", "text": "Kapsel", "cost": 10, "score": 8, "priority": "wont", "note": "Hohe Folgekosten und Verpackungsmüll – für die Zielgruppe kritisch." },
          { "id": "p3o3", "text": "Pad", "cost": 6, "score": 5, "priority": "should" },
          { "id": "p3o4", "text": "Bohnen mit Mahlwerk", "cost": 35, "score": 9, "priority": "could" }
        ]
      },
      {
        "id": "p4",
        "name": "Bedienung",
        "weight": 1,
        "categoryId": "k2",
        "options": [
          { "id": "p4o1", "text": "Drehknopf", "cost": 2, "score": 5, "priority": "must" },
          { "id": "p4o2", "text": "Tasten", "cost": 4, "score": 6, "priority": "should" },
          { "id": "p4o3", "text": "Touch-Display", "cost": 20, "score": 8, "priority": "could" },
          { "id": "p4o4", "text": "Smartphone-App", "cost": 15, "score": 7, "priority": "could" }
        ]
      },
      {
        "id": "p5",
        "name": "Energieversorgung",
        "weight": 2,
        "categoryId": "k2",
        "options": [
          { "id": "p5o1", "text": "Netzstrom", "cost": 3, "score": 8, "priority": "must" },
          { "id": "p5o2", "text": "Akku", "cost": 30, "score": 6, "priority": "could", "note": "Nur mit Thermoblock realistisch; Laufzeit ca. 8 Bezüge." },
          { "id": "p5o3", "text": "Gaskartusche", "cost": 15, "score": 5, "priority": "wont" },
          { "id": "p5o4", "text": "Muskelkraft", "cost": 1, "score": 3, "priority": "wont" }
        ]
      },
      {
        "id": "p6",
        "name": "Reinigung",
        "weight": 1,
        "categoryId": "k2",
        "options": [
          { "id": "p6o1", "text": "Manuell", "cost": 0, "score": 3, "priority": "must" },
          { "id": "p6o2", "text": "Automatische Spülung", "cost": 10, "score": 8, "priority": "should" },
          { "id": "p6o3", "text": "Spülmaschinenfest", "cost": 5, "score": 7, "priority": "should" }
        ]
      }
    ],
    "concepts": [
      {
        "id": "c1",
        "name": "Kompakt-Espresso",
        "note": "Günstigster Einstieg mit solider Espresso-Qualität, ideal für kleine Küchen.\nOffen: Lautstärke der Pumpe im Prototyp messen.",
        "color": "#2a78d6",
        "selections": { "p1": "p1o3", "p2": "p2o2", "p3": "p3o1", "p4": "p4o2", "p5": "p5o1", "p6": "p6o2" }
      },
      {
        "id": "c2",
        "name": "Outdoor",
        "note": "Für Camping: unabhängig vom Stromnetz, robust und leicht.",
        "color": "#eb6834",
        "selections": { "p1": "p1o4", "p2": "p2o4", "p3": "p3o3", "p4": "p4o1", "p5": "p5o4", "p6": "p6o1" }
      },
      {
        "id": "c3",
        "name": "Smart Home",
        "color": "#1baf7a",
        "selections": { "p1": "p1o2", "p2": "p2o3", "p3": "p3o4", "p4": "p4o4", "p5": "p5o1", "p6": "p6o2" }
      }
    ],
    "constraints": [
      { "a": "p1o4", "b": "p5o4", "type": "excluded", "note": "Induktion braucht elektrische Leistung" },
      { "a": "p1o4", "b": "p5o3", "type": "excluded", "note": "Induktion braucht elektrische Leistung" },
      { "a": "p1o1", "b": "p5o2", "type": "excluded", "note": "Leistungsbedarf zu hoch für einen Akku" },
      { "a": "p1o1", "b": "p5o4", "type": "excluded", "note": "Durchlauferhitzer braucht elektrische Leistung" },
      { "a": "p2o3", "b": "p5o4", "type": "excluded", "note": "Rotationspumpe braucht einen Motor" },
      { "a": "p4o4", "b": "p5o4", "type": "excluded", "note": "App braucht Elektronik und Strom" },
      { "a": "p4o3", "b": "p5o4", "type": "excluded", "note": "Display braucht Strom" },
      { "a": "p5o4", "b": "p6o2", "type": "excluded", "note": "Spülpumpe braucht Strom" },
      { "a": "p2o1", "b": "p3o2", "type": "excluded", "note": "Kapseln brauchen Druck" },
      { "a": "p1o3", "b": "p5o2", "type": "conditional", "note": "Nur mit großem Akku (mind. 100 Wh)" },
      { "a": "p3o4", "b": "p5o4", "type": "conditional", "note": "Nur mit Handmühle" },
      { "a": "p2o2", "b": "p5o3", "type": "conditional", "note": "Pumpe braucht zusätzlich einen kleinen Akku" }
    ],
    "activeConceptId": "c1"
  }
});
