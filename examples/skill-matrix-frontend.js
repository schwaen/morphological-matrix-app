/*
 * Beispiel „Skill-Matrix Frontend-Team“.
 * `data` hat dasselbe Format wie eine mit „Als JSON speichern“ exportierte Datei
 * (siehe docs/DATENFORMAT.md). Anleitung für weitere Beispiele: examples/README.md
 */
Examples.register({
  "id": "skill-matrix-frontend",
  "name": "Skill-Matrix Frontend-Team",
  "description": "Kompetenzen von drei Mitarbeitenden in Soft- und Hardskills eines Frontend-Entwicklers. Skala je Skill von 0 (keine Kenntnisse) bis 3 (Expertenwissen); der Nutzwert zeigt den gewichteten Kompetenzgrad.",
  "data": {
    "version": 3,
    "title": "Beispiel: Skill-Matrix Frontend-Team",
    "description": "Fähigkeiten im Frontend-Team je Skill einschätzen – 0 = keine Kenntnisse, 1 = Grundkenntnisse, 2 = fortgeschrittene Fähigkeiten, 3 = Expertenwissen. Jedes Konzept steht für eine Person; der Nutzwert zeigt den nach Wichtigkeit gewichteten Kompetenzgrad in Prozent.",
    "settings": { "costs": false, "utility": true, "currency": "EUR", "utilityMax": 100, "moscow": false },
    "categories": [
      { "id": "k1", "name": "Softskills", "color": "#4f46e5" },
      { "id": "k2", "name": "Webgrundlagen", "color": "#0891b2" },
      { "id": "k3", "name": "Frameworks & Werkzeuge", "color": "#d97706" },
      { "id": "k4", "name": "Qualität & Performance", "color": "#059669" }
    ],
    "parameters": [
      {
        "id": "s1",
        "name": "Kommunikation",
        "weight": 2,
        "categoryId": "k1",
        "options": [
          { "id": "s1l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s1l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s1l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s1l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s2",
        "name": "Teamfähigkeit",
        "weight": 2,
        "categoryId": "k1",
        "options": [
          { "id": "s2l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s2l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s2l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s2l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s3",
        "name": "Problemlösung",
        "weight": 3,
        "categoryId": "k1",
        "options": [
          { "id": "s3l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s3l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s3l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s3l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s4",
        "name": "Selbstorganisation",
        "weight": 1,
        "categoryId": "k1",
        "options": [
          { "id": "s4l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s4l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s4l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s4l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s5",
        "name": "Wissensweitergabe",
        "weight": 1,
        "categoryId": "k1",
        "options": [
          { "id": "s5l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s5l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s5l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s5l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s6",
        "name": "HTML & Semantik",
        "weight": 2,
        "categoryId": "k2",
        "options": [
          { "id": "s6l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s6l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s6l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s6l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s7",
        "name": "CSS & Responsive Design",
        "weight": 3,
        "categoryId": "k2",
        "options": [
          { "id": "s7l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s7l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s7l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s7l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s8",
        "name": "JavaScript",
        "weight": 3,
        "categoryId": "k2",
        "options": [
          { "id": "s8l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s8l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s8l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s8l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s9",
        "name": "TypeScript",
        "weight": 2,
        "categoryId": "k2",
        "options": [
          { "id": "s9l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s9l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s9l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s9l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s10",
        "name": "Barrierefreiheit",
        "weight": 2,
        "categoryId": "k2",
        "options": [
          { "id": "s10l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s10l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s10l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s10l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s11",
        "name": "React",
        "weight": 3,
        "categoryId": "k3",
        "options": [
          { "id": "s11l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s11l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s11l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s11l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s12",
        "name": "State-Management",
        "weight": 2,
        "categoryId": "k3",
        "options": [
          { "id": "s12l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s12l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s12l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s12l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s13",
        "name": "Build-Tools (Vite, Webpack)",
        "weight": 1,
        "categoryId": "k3",
        "options": [
          { "id": "s13l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s13l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s13l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s13l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s14",
        "name": "Git & Code-Review",
        "weight": 2,
        "categoryId": "k3",
        "options": [
          { "id": "s14l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s14l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s14l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s14l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s15",
        "name": "Automatisierte Tests",
        "weight": 2,
        "categoryId": "k4",
        "options": [
          { "id": "s15l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s15l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s15l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s15l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      },
      {
        "id": "s16",
        "name": "Web-Performance",
        "weight": 1,
        "categoryId": "k4",
        "options": [
          { "id": "s16l0", "text": "0 – keine Kenntnisse", "cost": null, "score": 0, "priority": null },
          { "id": "s16l1", "text": "1 – Grundkenntnisse", "cost": null, "score": 33, "priority": null },
          { "id": "s16l2", "text": "2 – fortgeschritten", "cost": null, "score": 67, "priority": null },
          { "id": "s16l3", "text": "3 – Experte", "cost": null, "score": 100, "priority": null }
        ]
      }
    ],
    "concepts": [
      {
        "id": "m1",
        "name": "Anna (Senior)",
        "color": "#2a78d6",
        "selections": { "s1": "s1l3", "s2": "s2l2", "s3": "s3l3", "s4": "s4l2", "s5": "s5l3", "s6": "s6l3", "s7": "s7l3", "s8": "s8l3", "s9": "s9l3", "s10": "s10l2", "s11": "s11l3", "s12": "s12l3", "s13": "s13l2", "s14": "s14l3", "s15": "s15l2", "s16": "s16l3" }
      },
      {
        "id": "m2",
        "name": "Ben (UI-Fokus)",
        "color": "#eb6834",
        "selections": { "s1": "s1l2", "s2": "s2l3", "s3": "s3l2", "s4": "s4l3", "s5": "s5l1", "s6": "s6l3", "s7": "s7l3", "s8": "s8l2", "s9": "s9l1", "s10": "s10l3", "s11": "s11l2", "s12": "s12l1", "s13": "s13l0", "s14": "s14l2", "s15": "s15l1", "s16": "s16l1" }
      },
      {
        "id": "m3",
        "name": "Clara (Junior)",
        "color": "#1baf7a",
        "selections": { "s1": "s1l2", "s2": "s2l2", "s3": "s3l1", "s4": "s4l1", "s5": "s5l0", "s6": "s6l2", "s7": "s7l1", "s8": "s8l1", "s9": "s9l0", "s10": "s10l1", "s11": "s11l1", "s12": "s12l0", "s13": "s13l1", "s14": "s14l1", "s15": "s15l2", "s16": "s16l0" }
      }
    ],
    "activeConceptId": "m1"
  }
});
