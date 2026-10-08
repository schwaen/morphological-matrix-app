/*
 * Beispiel „Food-Truck gründen“.
 * `data` hat dasselbe Format wie eine mit „Als JSON speichern“ exportierte Datei
 * (siehe docs/DATENFORMAT.md). Anleitung für weitere Beispiele: examples/README.md
 */
Examples.register({
  "id": "food-truck",
  "name": "Food-Truck gründen",
  "description": "Gründung eines Food-Trucks: Küche, Fahrzeug, Betrieb und Marke zu Geschäftsmodellen kombinieren. Mit Startinvestition, Nutzwert, Prioritäten (MoSCoW) für die Pfade MVP, Standard und Premium sowie Verträglichkeiten – ein Konzept zeigt absichtlich Konflikte.",
  "data": {
    "version": 5,
    "title": "Beispiel: Food-Truck gründen",
    "description": "Gründung eines Food-Trucks. Kosten = Startinvestition in Euro für den jeweiligen Baustein, Nutzwert = erwarteter Beitrag zum Geschäftserfolg von 0 bis 10. Die Prioritäten (MoSCoW) beschreiben den Ausbaupfad vom kleinen Einstieg (Must) bis zur Wunschausstattung (Could).",
    "settings": { "costs":  true, "utility":  true, "currency":  "EUR", "utilityMax":  10, "moscow":  true },
    "categories": [
      { "id":  "k1", "name":  "Konzept", "color":  "#4f46e5" },
      { "id":  "k2", "name":  "Fahrzeug & Technik", "color":  "#0891b2" },
      { "id":  "k3", "name":  "Betrieb", "color":  "#d97706" },
      { "id":  "k4", "name":  "Marke & Vertrieb", "color":  "#059669" }
    ],
    "parameters": [
      {
        "id": "p1",
        "name": "Küche",
        "note": "Bestimmt Ausstattung, Wareneinsatz und Zielgruppe.",
        "weight": 3,
        "categoryId": "k1",
        "options": [
          { "id":  "p1o1", "text":  "Smash-Burger & Pommes", "cost":  6000, "score":  7, "priority":  "must", "note":  "Bekannt und beliebt, aber viel Konkurrenz; Fritteuse braucht Abluft und Fettabscheider." },
          { "id":  "p1o2", "text":  "Neapolitanische Pizza", "cost":  14000, "score":  8, "priority":  "could", "note":  "Holzofen erreicht rund 450 °C; schwer und brandschutzrelevant." },
          { "id":  "p1o3", "text":  "Vegane Bowls", "cost":  4000, "score":  7, "priority":  "should" },
          { "id":  "p1o4", "text":  "Tacos & Burritos", "cost":  4500, "score":  8, "priority":  "should" },
          { "id":  "p1o5", "text":  "Crêpes & Kaffee", "cost":  3500, "score":  5, "priority":  "could" }
        ]
      },
      {
        "id": "p2",
        "name": "Signature-Element",
        "weight": 2,
        "categoryId": "k1",
        "options": [
          { "id":  "p2o1", "text":  "Hausgemachte Saucen", "cost":  500, "score":  6, "priority":  "must" },
          { "id":  "p2o2", "text":  "Zutaten vom Hof aus der Region", "cost":  1500, "score":  8, "priority":  "should", "note":  "Höherer Wareneinsatz, dafür eine starke Geschichte fürs Marketing." },
          { "id":  "p2o3", "text":  "Wechselndes Wochengericht", "cost":  300, "score":  5, "priority":  "could" },
          { "id":  "p2o4", "text":  "Live-Cooking als Show", "cost":  2000, "score":  7, "priority":  "could" }
        ]
      },
      {
        "id": "p3",
        "name": "Preisniveau",
        "note": "Preis je Hauptgericht.",
        "weight": 2,
        "categoryId": "k1",
        "options": [
          { "id":  "p3o1", "text":  "Günstig (unter 8 €)", "cost":  0, "score":  5, "priority":  "should" },
          { "id":  "p3o2", "text":  "Mittel (8–12 €)", "cost":  0, "score":  7, "priority":  "must" },
          { "id":  "p3o3", "text":  "Premium (über 12 €)", "cost":  0, "score":  6, "priority":  "could" }
        ]
      },
      {
        "id": "p4",
        "name": "Fahrzeug",
        "weight": 3,
        "categoryId": "k2",
        "options": [
          { "id":  "p4o1", "text":  "Verkaufsanhänger", "cost":  18000, "score":  5, "priority":  "must", "note":  "Kein eigener Motor: Zugfahrzeug nötig, dafür günstig und ohne Kfz-Wartung." },
          { "id":  "p4o2", "text":  "Gebrauchter Kastenwagen, umgebaut", "cost":  30000, "score":  6, "priority":  "should" },
          { "id":  "p4o3", "text":  "Neuer Food-Truck nach Maß", "cost":  85000, "score":  9, "priority":  "could" },
          { "id":  "p4o4", "text":  "Lastenrad-Küche", "cost":  9000, "score":  4, "priority":  "could", "note":  "Emissionsfrei und innenstadttauglich, aber kaum Lager- und Arbeitsfläche." },
          { "id":  "p4o5", "text":  "Oldtimer-Transporter", "cost":  55000, "score":  8, "priority":  "wont", "note":  "Fotogen und Kult, aber teuer in Kauf und Unterhalt." }
        ]
      },
      {
        "id": "p5",
        "name": "Energie",
        "weight": 2,
        "categoryId": "k2",
        "options": [
          { "id":  "p5o1", "text":  "Gas", "cost":  1500, "score":  6, "priority":  "must" },
          { "id":  "p5o2", "text":  "Benzin-Generator", "cost":  2000, "score":  3, "priority":  "wont", "note":  "Laut und riecht; auf vielen Märkten nicht erlaubt." },
          { "id":  "p5o3", "text":  "Starkstrom vom Stellplatz", "cost":  800, "score":  7, "priority":  "should" },
          { "id":  "p5o4", "text":  "Akku und Solardach", "cost":  12000, "score":  8, "priority":  "could" },
          { "id":  "p5o5", "text":  "Holzfeuer", "cost":  1000, "score":  6, "priority":  "could" }
        ]
      },
      {
        "id": "p6",
        "name": "Kühlung",
        "weight": 1,
        "categoryId": "k2",
        "options": [
          { "id":  "p6o1", "text":  "Kühlboxen", "cost":  300, "score":  3, "priority":  "must" },
          { "id":  "p6o2", "text":  "Kompressor-Kühlschrank", "cost":  2500, "score":  7, "priority":  "should" },
          { "id":  "p6o3", "text":  "Kühlzelle im eigenen Lager", "cost":  8000, "score":  8, "priority":  "could" }
        ]
      },
      {
        "id": "p7",
        "name": "Standorte",
        "note": "Kosten = Gebühren und Genehmigungen im ersten Jahr.",
        "weight": 3,
        "categoryId": "k3",
        "options": [
          { "id":  "p7o1", "text":  "Wochenmärkte", "cost":  600, "score":  6, "priority":  "must" },
          { "id":  "p7o2", "text":  "Gewerbegebiete zur Mittagszeit", "cost":  300, "score":  7, "priority":  "should" },
          { "id":  "p7o3", "text":  "Festivals & Events", "cost":  2500, "score":  8, "priority":  "should", "note":  "Hoher Umsatz an wenigen Tagen, aber Standgebühr oft als Umsatzbeteiligung." },
          { "id":  "p7o4", "text":  "Fester Stellplatz (Pacht)", "cost":  6000, "score":  7, "priority":  "could" }
        ]
      },
      {
        "id": "p8",
        "name": "Öffnungszeiten",
        "weight": 1,
        "categoryId": "k3",
        "options": [
          { "id":  "p8o1", "text":  "Mittags (11–15 Uhr)", "cost":  0, "score":  7, "priority":  "must" },
          { "id":  "p8o2", "text":  "Abends (17–22 Uhr)", "cost":  0, "score":  6, "priority":  "should" },
          { "id":  "p8o3", "text":  "Nur am Wochenende", "cost":  0, "score":  5, "priority":  "could" }
        ]
      },
      {
        "id": "p9",
        "name": "Bezahlung",
        "weight": 2,
        "categoryId": "k3",
        "options": [
          { "id":  "p9o1", "text":  "Nur bar", "cost":  0, "score":  3, "priority":  "wont" },
          { "id":  "p9o2", "text":  "Bar und Karte", "cost":  400, "score":  8, "priority":  "must" },
          { "id":  "p9o3", "text":  "Vorbestellung per App", "cost":  3000, "score":  7, "priority":  "could" }
        ]
      },
      {
        "id": "p10",
        "name": "Team",
        "note": "Kosten = Schulungen und Gesundheitszeugnisse; Löhne laufen extra.",
        "weight": 2,
        "categoryId": "k3",
        "options": [
          { "id":  "p10o1", "text":  "Allein", "cost":  0, "score":  4, "priority":  "must" },
          { "id":  "p10o2", "text":  "Zu zweit", "cost":  200, "score":  7, "priority":  "should" },
          { "id":  "p10o3", "text":  "Kernteam mit Aushilfen", "cost":  1500, "score":  8, "priority":  "could" }
        ]
      },
      {
        "id": "p11",
        "name": "Auftritt",
        "weight": 1,
        "categoryId": "k4",
        "options": [
          { "id":  "p11o1", "text":  "Selbst gestaltet", "cost":  200, "score":  3, "priority":  "must" },
          { "id":  "p11o2", "text":  "Design-Agentur und Folierung", "cost":  6000, "score":  8, "priority":  "should" },
          { "id":  "p11o3", "text":  "Retro-Stil mit Kreidetafeln", "cost":  1200, "score":  6, "priority":  "could" }
        ]
      },
      {
        "id": "p12",
        "name": "Online-Präsenz",
        "weight": 2,
        "categoryId": "k4",
        "options": [
          { "id":  "p12o1", "text":  "Instagram & TikTok", "cost":  0, "score":  7, "priority":  "must" },
          { "id":  "p12o2", "text":  "Website mit Standortkarte", "cost":  1500, "score":  6, "priority":  "should" },
          { "id":  "p12o3", "text":  "Lieferplattformen", "cost":  500, "score":  5, "priority":  "could" }
        ]
      },
      {
        "id": "p13",
        "name": "Zusatzgeschäft",
        "weight": 2,
        "categoryId": "k4",
        "options": [
          { "id":  "p13o1", "text":  "Keins", "cost":  0, "score":  2, "priority":  "must" },
          { "id":  "p13o2", "text":  "Catering für Firmen", "cost":  3000, "score":  8, "priority":  "should" },
          { "id":  "p13o3", "text":  "Hochzeiten & private Feiern", "cost":  2000, "score":  7, "priority":  "could" },
          { "id":  "p13o4", "text":  "Kochkurse", "cost":  1000, "score":  5, "priority":  "wont" }
        ]
      }
    ],
    "concepts": [
      {
        "id": "c1",
        "name": "Street-Food-Start",
        "note": "Kleiner Einstieg mit geringem Risiko: Standorte und Rezepte testen, dann wachsen.\nOffen: Zugfahrzeug leihen oder kaufen?",
        "color": "#2a78d6",
        "selections": { "p1":  "p1o1", "p2":  "p2o1", "p3":  "p3o2", "p4":  "p4o1", "p5":  "p5o1", "p6":  "p6o1", "p7":  "p7o1", "p8":  "p8o1", "p9":  "p9o2", "p10":  "p10o1", "p11":  "p11o1", "p12":  "p12o1", "p13":  "p13o1" }
      },
      {
        "id": "c2",
        "name": "Pizza-Festival-Tour",
        "note": "Auffälliger Auftritt für Sommer-Festivals und Hochzeiten; im Winter Catering.",
        "color": "#eb6834",
        "selections": { "p1":  "p1o2", "p2":  "p2o4", "p3":  "p3o2", "p4":  "p4o3", "p5":  "p5o5", "p6":  "p6o2", "p7":  "p7o3", "p8":  "p8o3", "p9":  "p9o2", "p10":  "p10o3", "p11":  "p11o2", "p12":  "p12o1", "p13":  "p13o3" }
      },
      {
        "id": "c3",
        "name": "Grüne Innenstadt",
        "note": "Emissionsfrei in der Fußgängerzone; einige Bausteine sind nur bedingt verträglich.",
        "color": "#1baf7a",
        "selections": { "p1":  "p1o3", "p2":  "p2o2", "p3":  "p3o3", "p4":  "p4o4", "p5":  "p5o4", "p6":  "p6o2", "p7":  "p7o2", "p8":  "p8o1", "p9":  "p9o3", "p10":  "p10o1", "p11":  "p11o3", "p12":  "p12o3", "p13":  "p13o1" }
      },
      {
        "id": "c4",
        "name": "Catering-Profi",
        "note": "Fester Stellplatz als Basis, Umsatz vor allem über Firmenaufträge.",
        "color": "#eda100",
        "selections": { "p1":  "p1o4", "p2":  "p2o2", "p3":  "p3o3", "p4":  "p4o2", "p5":  "p5o3", "p6":  "p6o3", "p7":  "p7o4", "p8":  "p8o2", "p9":  "p9o2", "p10":  "p10o2", "p11":  "p11o2", "p12":  "p12o2", "p13":  "p13o2" }
      },
      {
        "id": "c5",
        "name": "Idee vom Stammtisch",
        "note": "Zeigt, wie die App Unverträglichkeiten markiert: Pizza auf dem Lastenrad mit Generator, nur Bargeld und trotzdem Lieferplattformen.",
        "color": "#e87ba4",
        "selections": { "p1":  "p1o2", "p2":  "p2o4", "p3":  "p3o1", "p4":  "p4o4", "p5":  "p5o2", "p6":  "p6o1", "p7":  "p7o1", "p8":  "p8o2", "p9":  "p9o1", "p10":  "p10o1", "p11":  "p11o1", "p12":  "p12o3", "p13":  "p13o1" }
      }
    ],
    "constraints": [
      { "a":  "p1o2", "b":  "p4o4", "type":  "excluded", "note":  "Ein Pizzaofen ist für ein Lastenrad viel zu schwer." },
      { "a":  "p1o2", "b":  "p5o4", "type":  "excluded", "note":  "Ein Elektro-Pizzaofen übersteigt die Leistung des Akkus." },
      { "a":  "p1o1", "b":  "p5o4", "type":  "conditional", "note":  "Grillplatte und Fritteuse nur mit großem Speicher und Ladepausen." },
      { "a":  "p1o1", "b":  "p4o4", "type":  "conditional", "note":  "Ohne Fritteuse und nur mit kleiner Gas-Grillplatte." },
      { "a":  "p4o4", "b":  "p5o2", "type":  "excluded", "note":  "Kein Platz, und der Lärm passt nicht zum Konzept." },
      { "a":  "p4o4", "b":  "p5o5", "type":  "excluded", "note":  "Offenes Feuer auf dem Lastenrad ist nicht zulässig." },
      { "a":  "p4o4", "b":  "p6o2", "type":  "conditional", "note":  "Nur mit Zusatzakku." },
      { "a":  "p4o4", "b":  "p7o3", "type":  "conditional", "note":  "Nur bei kurzen Wegen zum Gelände." },
      { "a":  "p5o2", "b":  "p7o1", "type":  "excluded", "note":  "Generatoren sind auf den meisten Märkten untersagt." },
      { "a":  "p5o5", "b":  "p7o1", "type":  "conditional", "note":  "Funkenflug – je nach Marktordnung erlaubt." },
      { "a":  "p1o3", "b":  "p5o5", "type":  "excluded", "note":  "Bowls brauchen kein Feuer – Aufwand ohne Nutzen." },
      { "a":  "p6o1", "b":  "p7o3", "type":  "conditional", "note":  "Mehrtägige Festivals brauchen eine echte Kühlung." },
      { "a":  "p10o1", "b":  "p7o3", "type":  "excluded", "note":  "Der Andrang auf Festivals ist allein nicht zu bewältigen." },
      { "a":  "p10o1", "b":  "p2o4", "type":  "conditional", "note":  "Show und Kasse gleichzeitig nur bei wenig Andrang." },
      { "a":  "p7o2", "b":  "p8o2", "type":  "excluded", "note":  "Gewerbegebiete sind abends leer." },
      { "a":  "p3o3", "b":  "p7o2", "type":  "conditional", "note":  "Mittagsgäste vergleichen mit der Kantine." },
      { "a":  "p12o3", "b":  "p9o1", "type":  "excluded", "note":  "Lieferplattformen rechnen ausschließlich bargeldlos ab." },
      { "a":  "p13o2", "b":  "p9o1", "type":  "conditional", "note":  "Firmen zahlen in der Regel auf Rechnung." }
    ],
    "activeConceptId": "c1"
  }
});
