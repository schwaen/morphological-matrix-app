# Morphologische Matrix

Responsive Web-App zum Erstellen einer morphologischen Matrix (Zwicky-Box). Läuft direkt im Browser, ohne Build-Schritt, ohne Abhängigkeiten.

## Starten

`index.html` im Browser öffnen (Doppelklick genügt). Alternativ über einen beliebigen statischen Webserver ausliefern, z. B.:

```sh
python3 -m http.server 8000
```

## Funktionen

- **Bearbeiten-Modus:** Parameter (Zeilen) und Ausprägungen (Zellen) anlegen, umbenennen, verschieben und löschen.
  - `Enter` springt zur nächsten Ausprägung bzw. legt eine neue an, `Umschalt+Enter` erzeugt einen Zeilenumbruch.
  - `Rücktaste` in einer leeren Ausprägung löscht sie.
  - Reihenfolge ändern: Parameter mit ↑/↓, Ausprägungen mit ←/→ (Leiste erscheint beim Überfahren der Zelle, auf Touch-Geräten immer sichtbar) oder per `Alt+←`/`Alt+→` im Textfeld.
- **Kategorien (optional):** Parameter lassen sich für große Matrizen in Kategorien gliedern (**Kategorie hinzufügen** im Bearbeiten-Modus, Zuordnung per Auswahlfeld in der Parameterzelle oder „+ Parameter“ direkt in einer Kategorie). Jede Kategorie erscheint als farbige, einklappbare Kopfzeile; eingeklappt zeigt sie die Auswahl des aktiven Konzepts. Über der Matrix springen Chips zu einer Kategorie, dazu „Alle ein-/ausklappen“. Der Einklappzustand gilt pro Tab, beim Drucken wird alles ausgeklappt. Konzeptvergleich, Zusammenfassung und CSV-Export sind nach Kategorien gegliedert.
- **Kombinieren-Modus:** Lösungskonzepte bilden, indem je Parameter eine Ausprägung angeklickt wird. Jedes Konzept hat eine eigene Farbe; die Auswahl wird durch Verbindungslinien dargestellt.
- Konzepte anlegen, duplizieren, umbenennen, umfärben, zufällig befüllen.
- Kennzahlen: Anzahl Parameter, Ausprägungen und mögliche Kombinationen.
- **Optionale Bewertung** (pro Matrix über **Datei → Bewertung: Kosten & Nutzwert** zuschaltbar, standardmäßig aus):
  - **Kosten** je Ausprägung in wählbarer Währung (EUR, USD, CHF, GBP); je Konzept werden die Gesamtkosten summiert.
  - **Nutzwert** je Ausprägung als Erfüllungsgrad (Skala 0–5, 0–10 oder 0–100) und optionale **Gewichtung** je Parameter (Standard 1). Der Nutzwert eines Konzepts ist wie in der Nutzwertanalyse Σ(Gewicht × Erfüllungsgrad) / Σ Gewichte; nicht gewählte oder unbewertete Parameter zählen mit 0.
  - Sind beide aktiv, zeigt der Konzeptvergleich zusätzlich das **Preis-Leistungs-Verhältnis** als Kosten je Nutzwertpunkt (Gesamtkosten ÷ Nutzwert, niedriger ist besser). Es wird nur berechnet, wenn Kosten und Nutzwerte des Konzepts vollständig gepflegt sind.
  - Ergebnisse in der Konzeptzusammenfassung und im Konzeptvergleich (bester Wert hervorgehoben, unvollständige Werte mit * markiert) sowie im CSV-Export.
  - **Konzepte automatisch erstellen** (Seitenleiste, nur bei aktivierter Bewertung): *Höchster Nutzwert*, *Geringster Nutzwert*, *Geringste Kosten*, *Höchste Kosten* und *Beste Preis-Leistung*. Die ersten vier wählen je Parameter die passende Ausprägung (bei Gleichstand entscheidet Kosten bzw. Nutzwert); *Beste Preis-Leistung* findet exakt die Kombination mit den geringsten Kosten je Nutzwertpunkt (Dinkelbach-Verfahren) und setzt voraus, dass jeder Parameter Ausprägungen mit Kosten und Nutzwert hat. Existiert die Kombination schon, wird das vorhandene Konzept ausgewählt.
  - Ausgeblendete Werte bleiben erhalten.
- Konzeptvergleich als Tabelle, ein- und ausklappbar (Zustand wird gemerkt; beim Drucken immer sichtbar).
- Rückgängig / Wiederholen (`Strg+Z`, `Strg+Umschalt+Z`).
- Automatisches Speichern im Browser (localStorage), beliebig viele Matrizen unter **Datei → Meine Matrizen**.
- **Beispiele:** Mitgelieferte Beispiele lassen sich über **Datei → Beispiele …** oder **+ → Beispiel öffnen …** auswählen und öffnen sich als eigene Matrix in einem neuen Tab – derzeit *Kaffeemaschine* (Produktentwicklung mit Kosten und Nutzwerten), *Skill-Matrix Frontend-Team* (Kompetenzen von Mitarbeitenden: Skills als Parameter, Stufen 0–3 als Ausprägungen, Personen als Konzepte) und *Elektro-Lastenrad* (umfangreich: 30 Parameter, 115 Ausprägungen, 7 Konzepte – gut zum Testen großer Matrizen). Jedes Beispiel steht in einer eigenen Datei unter `examples/` – siehe [`examples/README.md`](examples/README.md).
- **Tabs in der App:** Mehrere Matrizen sind gleichzeitig in Tabs in der Kopfzeile geöffnet. Jeder Tab behält Ansicht (Modus, Konzeptvergleich, eingeklappte Kategorien), Rückgängig-Verlauf und Scroll-Position. Über **+** lassen sich eine neue leere Matrix, ein Beispiel, ein JSON-Import, eine Matrix aus „Meine Matrizen“ oder ein zuletzt geschlossener Tab öffnen. Doppelklick auf den aktiven Tab benennt die Matrix um; Tabs lassen sich per Ziehen umsortieren und mit × oder der mittleren Maustaste schließen (die Matrix bleibt gespeichert). Geöffnete Tabs werden nach dem Neuladen wiederhergestellt; eine bereits geöffnete Matrix wird nicht doppelt geöffnet.
- **Mehrere Browser-Tabs:** Weiterhin möglich – jeder Browser-Tab hat seine eigenen App-Tabs. Ändert ein anderer Browser-Tab eine hier geöffnete Matrix, wird sie übernommen; inaktive Tabs werden dabei mit einem Punkt markiert.
- Export als JSON (`Strg+S`) und CSV (Excel-kompatibel), Import von JSON.
- Teilen per Link (die Matrix steckt komplett in der URL).
- Druckansicht bzw. PDF-Export über den Browser.
- Helles und dunkles Farbschema (folgt der Systemeinstellung).

## Dateien

| Datei / Ordner | Inhalt |
|---|---|
| `index.html` | Seitengerüst, lädt die Skripte in fester Reihenfolge |
| `styles.css` | Design in Kaskaden-Ebenen (`@layer`): Tokens, Grundstile, Bausteine, Bereiche, Druck |
| `js/texts.js` | `Texts` – alle Texte, die das JavaScript anzeigt (Hinweise, Beschriftungen, Fehlermeldungen, CSV-Spalten) |
| `js/util.js` | `Util` – Zahlen, Texte, Kodierung (ohne DOM) |
| `js/model.js` | `Model` – Datenmodell, Normalisierung, Abfragen (ohne DOM) |
| `js/evaluation.js` | `Evaluation` – Kosten, Nutzwert, Preis-Leistung, automatische Konzepte (ohne DOM) |
| `js/io.js` | `IO` – JSON, CSV, Teilen-Links (ohne DOM) |
| `js/storage.js` | `Store` – Speicherung im Browser (Bibliothek, geöffnete Tabs, Einstellungen pro Browser-Tab) |
| `js/examples.js` | `Examples` – Verzeichnis der mitgelieferten Beispiele |
| `examples/` | Mitgelieferte Beispiele, je Beispiel eine Datei (Anleitung in `examples/README.md`) |
| `js/ui/` | Oberfläche: `dom` (Helfer), `core` (Zustand, Verlauf), `tabs` (App-Tabs), `actions`, `render-matrix`, `render-panels`, `lines`, `dialogs`, `main` (Start) |
| `types.d.ts` | Typen des Datenmodells (nur Entwicklung) |
| `docs/DATENFORMAT.md` | Datenformat (JSON, Speicherung, Teilen-Links), Versionen und Migrationen |
| `tests/unit/` | Unit-Tests der Logik (`node:test`) |
| `tests/e2e/` | Browser-Tests (Playwright) |

**Texte:** Statische Texte stehen in `index.html`, alle vom JavaScript erzeugten Texte in `js/texts.js` – Formulierungen ändern oder übersetzen betrifft nur diese beiden Dateien. Inhalte der Beispiele sind Daten und stehen je Beispiel in einer eigenen Datei unter `examples/`.

**Datenformat:** Gespeicherte Matrizen, JSON-Export und Teilen-Links tragen eine Formatversion; ältere Daten werden beim Öffnen automatisch umgewandelt, Daten aus einer neueren App-Version werden abgelehnt. Details in [`docs/DATENFORMAT.md`](docs/DATENFORMAT.md).

**Aufbau ohne Build:** Alle Dateien sind klassische Skripte (keine ES-Module), damit die App weiterhin per Doppelklick über `file://` läuft. Die Logik-Dateien stellen je genau einen Namensraum bereit (`Util`, `Model`, `Evaluation`, `IO`, `Store`) und arbeiten auf einer übergebenen Matrix statt auf globalem Zustand. Die Dateien unter `js/ui/` teilen sich ihre Funktionen über den globalen Gültigkeitsbereich; Änderungen am Zustand laufen über `mutate()` (strukturell, mit Rückgängig), `bindField()` (Texteingaben) bzw. `setPref()` (Ansicht pro Tab) – siehe Kopfkommentar in `js/ui/core.js`.

## Entwicklung

Die App selbst braucht weder Build noch Server. Für Qualitätssicherung gibt es Entwicklungswerkzeuge (Node.js ≥ 22):

```sh
npm install                      # Werkzeuge installieren (einmalig)
npx playwright install chromium  # Browser für die Tests (einmalig)

npm run lint        # ESLint
npm run typecheck   # Typprüfung des JavaScript per JSDoc (tsc, ohne Build)
npm run test:unit   # Unit-Tests der Logik (node:test, ohne Browser)
npm run test:e2e    # Browser-Tests (Playwright) gegen index.html per file://
npm test            # alles zusammen
```

- **Typen:** Das Datenmodell ist in `types.d.ts` beschrieben (nur für Editor und `tsc`, wird vom Browser nicht geladen). Die Skripte nutzen diese Typen über JSDoc-Kommentare; `tsc` prüft auch die Bezüge zwischen den Dateien.
- **Tests:** `tests/e2e/` – je Funktionsbereich eine Datei (Grundlagen, Speichern/Export, Beispiele, App-Tabs, mehrere Browser-Tabs, Bewertung, automatische Konzepte, Kategorien, Reihenfolge). Jeder Test startet mit leerem Speicher und schlägt bei JavaScript-Fehlern der Seite fehl.
- **Unit-Tests:** `tests/unit/` lädt die DOM-freien Skripte in einen isolierten Node-Kontext (`tests/unit/load.js`) – so, wie der Browser sie ausführt. Die automatischen Konzepte werden u. a. auf 300 Zufallsmatrizen gegen eine vollständige Durchrechnung geprüft.
- **CI:** `.github/workflows/ci.yml` führt Lint, Typprüfung, Unit- und Browser-Tests bei jedem Pull Request aus.
