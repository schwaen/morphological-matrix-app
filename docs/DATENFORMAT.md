# Datenformat einer Matrix

Dieses Format wird verwendet für gespeicherte Matrizen (localStorage), den JSON-Export, Teilen-Links (`#m=…`, Base64url-kodiertes JSON) und die mitgelieferten Beispiele (`data` in `examples/*.js`, siehe [`examples/README.md`](../examples/README.md)). Typdefinitionen für die Entwicklung stehen in [`types.d.ts`](../types.d.ts).

**Aktuelle Version: 2** (`Model.SCHEMA_VERSION` in `js/model.js`)

## Aufbau

```jsonc
{
  "version": 2,
  "title": "Beispiel: Kaffeemaschine",
  "description": "Gesamtfunktion: …",
  "settings": {
    "costs": false,          // Kosten je Ausprägung erfassen
    "utility": false,        // Nutzwert je Ausprägung erfassen
    "currency": "EUR",       // EUR | USD | CHF | GBP
    "utilityMax": 10         // Nutzwert-Skala: 5 | 10 | 100
  },
  "categories": [            // optional, Reihenfolge = Anzeige
    { "id": "k1", "name": "Brühsystem", "color": "#4f46e5" }
  ],
  "parameters": [            // nach Kategorien gruppiert, ohne Kategorie zuletzt
    {
      "id": "p1",
      "name": "Wassererwärmung",
      "weight": 3,           // Gewichtung für den Nutzwert, null = 1
      "categoryId": "k1",    // null = ohne Kategorie
      "options": [
        { "id": "o1", "text": "Durchlauferhitzer", "cost": 18, "score": 6 }  // cost/score: null = nicht erfasst
      ]
    }
  ],
  "concepts": [
    {
      "id": "c1",
      "name": "Kompakt-Espresso",
      "color": "#e8590c",
      "selections": { "p1": "o1" }   // Parameter-ID → Ausprägungs-ID
    }
  ],
  "activeConceptId": "c1"
}
```

## Regeln beim Einlesen (`Model.normalize`)

- `parameters` muss eine Liste sein, sonst wird die Datei abgelehnt.
- Fehlt `version`, gilt Version 1. Ältere Versionen werden schrittweise auf die aktuelle migriert (`Model.migrate`).
- Daten mit einer **höheren** Version als unterstützt werden abgelehnt – so gehen keine unbekannten Felder still verloren.
- Fehlende oder ungültige Felder werden mit Standardwerten ergänzt; doppelte IDs werden ersetzt.
- Auswahlen, die auf nicht vorhandene Ausprägungen zeigen, und Zuordnungen zu unbekannten Kategorien werden entfernt.
- Negative Gewichte werden verworfen; ungültige Farben durch Standardfarben ersetzt.

## Versionen

| Version | Änderung | Migration |
|---|---|---|
| 1 | Erste Fassungen ohne Versionierung bzw. mit `version: 1`; Ausprägungen anfangs als reine Texte, Bewertung und Kategorien kamen später als optionale Felder hinzu | – |
| 2 | Versioniertes Format; Ausprägungen immer als Objekte `{ id, text, cost, score }` | Texte werden zu Objekten |

## Eine neue Version einführen

1. `SCHEMA_VERSION` in `js/model.js` erhöhen.
2. In `MIGRATIONS` eine Funktion `alteVersion → neueVersion` ergänzen (Rohdaten rein, Rohdaten raus).
3. `normalize()`, `types.d.ts` und dieses Dokument anpassen.
4. Unit-Test in `tests/unit/model.test.js` für die Migration ergänzen.
5. Die Beispiele unter `examples/` auf die neue Version bringen (der Unit-Test `tests/unit/examples.test.js` verlangt das aktuelle Format) – am einfachsten: Beispiel in der App öffnen, als JSON speichern und `data` ersetzen.
