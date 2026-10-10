# Datenformat einer Matrix

Dieses Format wird verwendet für gespeicherte Matrizen (localStorage), den JSON-Export, Teilen-Links (`#m=…`, Base64url-kodiertes JSON) und die mitgelieferten Beispiele (`data` in `examples/*.json`, siehe [`examples/README.md`](../examples/README.md)). Typdefinitionen für die Entwicklung stehen in [`types.d.ts`](../types.d.ts).

**Aktuelle Version: 6** (`Model.SCHEMA_VERSION` in `js/model.js`)

## Aufbau

```jsonc
{
  "version": 6,
  "title": "Beispiel: Kaffeemaschine",
  "description": "Gesamtfunktion: …",
  "settings": {
    "costs": false,          // Kosten je Ausprägung erfassen
    "utility": false,        // Nutzwert je Ausprägung erfassen
    "currency": "EUR",       // EUR | USD | CHF | GBP
    "utilityMax": 10,        // Nutzwert-Skala: 5 | 10 | 100
    "moscow": false          // Priorität (MoSCoW) je Ausprägung erfassen
  },
  "categories": [            // optional, Reihenfolge = Anzeige
    { "id": "k1", "name": "Brühsystem", "color": "#4f46e5" }
  ],
  "parameters": [            // nach Kategorien gruppiert, ohne Kategorie zuletzt
    {
      "id": "p1",
      "name": "Wassererwärmung",
      "note": "",            // Beschreibung des Parameters (optional, leer = keine)
      "weight": 3,           // Gewichtung für den Nutzwert, null = 1
      "categoryId": "k1",    // null = ohne Kategorie
      "options": [
        // cost/score/priority: null = nicht erfasst; priority: "must" | "should" | "could" | "wont";
        // note: Notiz zur Ausprägung (optional, leer = keine)
        { "id": "o1", "text": "Durchlauferhitzer", "cost": 18, "score": 6, "priority": "must", "note": "" }
      ]
    }
  ],
  "concepts": [
    {
      "id": "c1",
      "name": "Kompakt-Espresso",
      "color": "#2a78d6",
      "note": "Günstigster Einstieg …",  // Begründung / Notiz (optional, leer = keine)
      "status": "favorite",    // "draft" (Entwurf, Standard) | "favorite" | "dropped" (verworfen) | "chosen" (gewählt)
      "statusNote": "",        // Grund zum Status (optional, leer = keiner)
      "selections": { "p1": "o1" }   // Parameter-ID → Ausprägungs-ID
    }
  ],
  "constraints": [           // Verträglichkeiten (optional): nur nicht verträgliche Paare
    // a < b (Zeichenkettenvergleich), Ausprägungen verschiedener Parameter;
    // type: "excluded" (unverträglich) | "conditional" (bedingt verträglich)
    { "a": "o1", "b": "o9", "type": "excluded", "note": "Braucht Netzstrom" }
  ],
  "activeConceptId": "c1"
}
```

## Backup (ZIP-Archiv)

„Meine Matrizen → Backup herunterladen“ erzeugt `morphologische-matrizen-backup-JJJJ-MM-TT.zip` mit

- je Matrix einer JSON-Datei im obigen Format (Dateiname aus dem Titel, bei Gleichheit `-2`, `-3` …),
- `backup.json` als Inhaltsübersicht:

```jsonc
{
  "format": "morphologische-matrix-backup",
  "version": 1,
  "created": "2026-10-06T10:00:00.000Z",
  "matrices": [
    { "file": "kaffeemaschine.json", "id": "k3x…", "savedAt": 1791280000000, "title": "Beispiel: Kaffeemaschine" }
  ]
}
```

Beim Wiederherstellen (`IO.parseBackup`, `IO.planRestore`) werden vorhandene Matrizen nie überschrieben: Matrizen mit unbekannter Kennung werden mit ihrer Kennung und ihrem Speicherzeitpunkt übernommen, inhaltsgleiche übersprungen; weicht eine vorhandene Matrix gleicher Kennung ab, wird das Backup als Kopie mit neuer Kennung angelegt. Fehlt `backup.json` (z. B. selbst gepackte Archive oder einzelne JSON-Dateien), gelten alle Matrizen als neu.

## Regeln beim Einlesen (`Model.normalize`)

- `parameters` muss eine Liste sein, sonst wird die Datei abgelehnt.
- Fehlt `version`, gilt Version 1. Ältere Versionen werden schrittweise auf die aktuelle migriert (`Model.migrate`).
- Daten mit einer **höheren** Version als unterstützt werden abgelehnt – so gehen keine unbekannten Felder still verloren.
- Fehlende oder ungültige Felder werden mit Standardwerten ergänzt; doppelte IDs werden ersetzt.
- Auswahlen, die auf nicht vorhandene Ausprägungen zeigen, und Zuordnungen zu unbekannten Kategorien werden entfernt.
- Negative Gewichte werden verworfen; ungültige Farben durch Standardfarben ersetzt; unbekannte Prioritäten werden zu `null`.
- Fehlende Notizen (`note`) werden zu `""` – in Dateien und Beispielen dürfen sie daher fehlen.
- Fehlender oder unbekannter Konzept-Status wird zu `"draft"`, ein fehlender Grund (`statusNote`) zu `""` – auch diese Felder dürfen in Dateien fehlen.
- Verträglichkeiten: Paare mit unbekannten Ausprägungen, aus demselben Parameter, mit unbekannter Art oder doppelt werden verworfen; `a` und `b` werden so geordnet, dass `a < b`. Beim Löschen einer Ausprägung oder eines Parameters entfallen die zugehörigen Paare.

## Versionen

| Version | Änderung | Migration |
|---|---|---|
| 1 | Erste Fassungen ohne Versionierung bzw. mit `version: 1`; Ausprägungen anfangs als reine Texte, Bewertung und Kategorien kamen später als optionale Felder hinzu | – |
| 2 | Versioniertes Format; Ausprägungen immer als Objekte `{ id, text, cost, score }` | Texte werden zu Objekten |
| 3 | Priorität nach MoSCoW: `priority` je Ausprägung, `settings.moscow` | keine Umwandlung nötig (fehlende Felder ergänzt `normalize`); die neue Version verhindert, dass ältere App-Versionen Prioritäten beim Öffnen stillschweigend verwerfen |
| 4 | Notizen: `note` je Ausprägung (Notiz), Parameter (Beschreibung) und Konzept (Begründung) | keine Umwandlung nötig; die neue Version verhindert, dass ältere App-Versionen Notizen verwerfen |
| 5 | Verträglichkeiten zwischen Ausprägungen: `constraints` | keine Umwandlung nötig; die neue Version verhindert, dass ältere App-Versionen Verträglichkeiten verwerfen |
| 6 | Status je Konzept: `status`, `statusNote` | keine Umwandlung nötig (fehlt der Status, gilt „Entwurf“); die neue Version verhindert, dass ältere App-Versionen den Status verwerfen |

## Eine neue Version einführen

1. `SCHEMA_VERSION` in `js/model.js` erhöhen.
2. In `MIGRATIONS` eine Funktion `alteVersion → neueVersion` ergänzen (Rohdaten rein, Rohdaten raus).
3. `normalize()`, `types.d.ts` und dieses Dokument anpassen.
4. Unit-Test in `tests/unit/model.test.js` für die Migration ergänzen.
5. Die Beispiele unter `examples/` auf die neue Version bringen (der Unit-Test `tests/unit/examples.test.js` verlangt das aktuelle Format) – am einfachsten: Beispiel in der App öffnen, als JSON speichern und `data` ersetzen.
