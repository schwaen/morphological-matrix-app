# Morphologische Matrix

Responsive Web-App zum Erstellen einer morphologischen Matrix (Zwicky-Box). Läuft im Browser, ohne Server-Backend; die Oberfläche nutzt [Preact](https://preactjs.com) mit [Signals](https://preactjs.com/guide/v10/signals/), gebaut wird mit [Vite](https://vite.dev).

## Starten

Die App ist auf GitHub Pages veröffentlicht: <https://schwaen.github.io/morphological-matrix-app/>

Lokal (Node.js ≥ 22):

```sh
npm install      # einmalig
npm run dev      # Entwicklungsserver mit sofortiger Aktualisierung, http://localhost:5173/
npm run build    # Build nach dist/
npm run preview  # gebaute App ansehen, http://localhost:4173/
```

`index.html` lässt sich nicht mehr per Doppelklick öffnen: Die App besteht aus ES-Modulen, die Browser nur über `http(s)://` laden.

## Funktionen

- **Bearbeiten-Modus:** Parameter (Zeilen) und Ausprägungen (Zellen) anlegen, umbenennen, verschieben und löschen.
  - `Enter` springt zur nächsten Ausprägung bzw. legt eine neue an, `Umschalt+Enter` erzeugt einen Zeilenumbruch.
  - `Rücktaste` in einer leeren Ausprägung löscht sie.
  - Reihenfolge ändern: Parameter mit ↑/↓, Ausprägungen mit ←/→ (Leiste erscheint beim Überfahren der Zelle, auf Touch-Geräten immer sichtbar) oder per `Alt+←`/`Alt+→` im Textfeld.
- **Kategorien (optional):** Parameter lassen sich für große Matrizen in Kategorien gliedern (**Kategorie hinzufügen** im Bearbeiten-Modus, Zuordnung per Auswahlfeld in der Parameterzelle oder „+ Parameter“ direkt in einer Kategorie). Jede Kategorie erscheint als farbige, einklappbare Kopfzeile; eingeklappt zeigt sie die Auswahl des aktiven Konzepts. Über der Matrix springen Chips zu einer Kategorie, dazu „Alle ein-/ausklappen“. Der Einklappzustand gilt pro Tab, beim Drucken wird alles ausgeklappt. Konzeptvergleich, Zusammenfassung und CSV-Export sind nach Kategorien gegliedert.
- **Kombinieren-Modus:** Lösungskonzepte bilden, indem je Parameter eine Ausprägung angeklickt wird. Jedes Konzept hat eine eigene Farbe; die Auswahl wird durch Verbindungslinien dargestellt.
  - **Linien:** *Aktives* (Standard) zeigt nur das aktive Konzept deutlich, die übrigen dezent; *Alle* zeigt alle gleich deutlich; *Aus* blendet die Linien aus. Beim Darüberfahren über ein Konzept wird dessen Linie hervorgehoben.
  - Die Konzeptfarben stammen aus einer auf Farbsehschwächen geprüften Farbreihe; im dunklen Farbschema werden sie in einer passenden dunklen Stufe angezeigt (gespeichert bleibt die helle Farbe). Bestehende Matrizen behalten ihre Farben.
- Konzepte anlegen, duplizieren, umbenennen, umfärben, zufällig befüllen.
- **Verträglichkeiten zwischen Ausprägungen** (Konsistenzprüfung nach Zwicky/Ritchey): Paare von Ausprägungen verschiedener Parameter lassen sich als *unverträglich* oder *bedingt verträglich* (mit Begründung) kennzeichnen; alle übrigen gelten als verträglich.
  - **Pflege direkt an der Ausprägung** (Bearbeiten-Modus): Knopf ⊘ in der Werkzeugleiste der Zelle bzw. der Zähler „⊘ n / ! n“ öffnet eine Liste aller Ausprägungen der anderen Parameter mit den Schaltern ✓ / ! / ✕ und einem Feld für die Begründung. Ein Paar gilt in beide Richtungen.
  - **Verträglichkeitsmatrix** (**Datei → Verträglichkeiten …** oder Knopf unter der Matrix): alle Paare als Dreiecksmatrix. Ein Klick wählt ein Feld aus; rechts lassen sich Verträglichkeit (✓ / ! / ✕) und Begründung festlegen oder korrigieren, dazu stehen dort die betroffenen Konzepte. Doppelklick oder `Enter`/Leertaste schaltet direkt weiter (verträglich → bedingt → unverträglich). Wird ein Paar wieder verträglich, merkt sich die App seine Begründung für die Sitzung und setzt sie wieder ein, wenn das Paar erneut bedingt oder unverträglich wird. Die Matrix ist ein einziger Tab-Stopp; die Pfeiltasten wandern von Feld zu Feld.
  - **Im Kombinieren-Modus:** Gewählte Ausprägungen, die sich widersprechen, sind rot als „Konflikt“ markiert. Ausprägungen, die nicht zur Auswahl des aktiven Konzepts passen, erscheinen schraffiert und durchgestrichen (✕), bedingt verträgliche mit „!“ – wählbar bleiben sie trotzdem (z. B. für Negativ-Konzepte). Beim Überfahren nennt ein Hinweis Partner und Begründung.
  - Die Kennzahl zeigt zusätzlich, wie viele Kombinationen **widerspruchsfrei** sind; Konzepte mit Konflikt tragen in der Liste „⚠ n“; die Zusammenfassung listet Konflikte und bedingte Paare mit Begründung.
  - **Konzeptvergleich:** Zeile „Verträglichkeit“ (widerspruchsfrei bzw. Konflikte) und Schalter „Konzepte mit Konflikt ausblenden“.
  - **Automatische Konzepte** und **Zufällig** erzeugen nur widerspruchsfreie Kombinationen (die Optimierung bleibt exakt); der CSV-Export enthält die Liste der Paare und die Unverträglichkeiten je Konzept.
- **Notizen und Begründungen:**
  - Im Bearbeiten-Modus lässt sich je Ausprägung eine **Notiz** und je Parameter eine **Beschreibung** erfassen (Notiz-Knopf in der Werkzeugleiste der Zelle; ein leeres Notizfeld verschwindet beim Verlassen wieder).
  - Im Kombinieren-Modus zeigt ein Symbol, dass es eine Notiz gibt; beim Überfahren erscheint sie in einem kleinen Fenster (für Screenreader als Beschreibung der Zelle).
  - Je Konzept gibt es in der Seitenleiste das Feld **Begründung / Notiz** (z. B. Vor- und Nachteile, offene Punkte). Die Zusammenfassung zeigt darunter die Notizen der gewählten Ausprägungen – so sind sie auch auf dem Handy und im Ausdruck sichtbar.
  - Der Konzeptvergleich zeigt die Begründungen als erste Zeile; Ausprägungen mit Notiz tragen das Notiz-Symbol (Notiz als Tooltip). Suche und CSV-Export beziehen Notizen ein.
- Kennzahlen: Anzahl Parameter, Ausprägungen und mögliche Kombinationen.
- **Optionale Bewertung** (pro Matrix über **Datei → Bewertung: Kosten, Nutzwert & Priorität** zuschaltbar, standardmäßig aus):
  - **Kosten** je Ausprägung in wählbarer Währung (EUR, USD, CHF, GBP); je Konzept werden die Gesamtkosten summiert.
  - **Nutzwert** je Ausprägung als Erfüllungsgrad (Skala 0–5, 0–10 oder 0–100) und optionale **Gewichtung** je Parameter (Standard 1). Der Nutzwert eines Konzepts ist wie in der Nutzwertanalyse Σ(Gewicht × Erfüllungsgrad) / Σ Gewichte; nicht gewählte oder unbewertete Parameter zählen mit 0.
  - Sind beide aktiv, zeigt der Konzeptvergleich zusätzlich das **Preis-Leistungs-Verhältnis** als Kosten je Nutzwertpunkt (Gesamtkosten ÷ Nutzwert, niedriger ist besser). Es wird nur berechnet, wenn Kosten und Nutzwerte des Konzepts vollständig gepflegt sind.
  - Ergebnisse in der Konzeptzusammenfassung und im Konzeptvergleich (bester Wert hervorgehoben, unvollständige Werte mit * markiert) sowie im CSV-Export.
  - **Konzepte automatisch erstellen** (Seitenleiste, nur bei aktivierter Bewertung): *Höchster Nutzwert*, *Geringster Nutzwert*, *Geringste Kosten*, *Höchste Kosten* und *Beste Preis-Leistung*. Die ersten vier wählen je Parameter die passende Ausprägung (bei Gleichstand entscheidet Kosten bzw. Nutzwert); *Beste Preis-Leistung* findet exakt die Kombination mit den geringsten Kosten je Nutzwertpunkt (Dinkelbach-Verfahren) und setzt voraus, dass jeder Parameter Ausprägungen mit Kosten und Nutzwert hat. Existiert die Kombination schon, wird das vorhandene Konzept ausgewählt.
  - **Priorität nach MoSCoW** je Ausprägung: *Must have*, *Should have*, *Could have*, *Won't have*. Die Kürzel M/S/C/W stehen in den Zellen; Won't-Ausprägungen sind abgeschwächt, bleiben aber wählbar (z. B. für Negativ-Konzepte). Zusammenfassung und Konzeptvergleich zeigen je Konzept, wie viele Ausprägungen welcher Priorität gewählt sind.
  - **Konzepte nach Priorität** (bei aktivierter Priorität): *MVP* wählt je Parameter die Must-Ausprägung (bei mehreren die günstigste), *Standard* die Should-, *Premium* die Could-Ausprägung (bei mehreren jeweils die mit dem höchsten Nutzwert). Es gibt keinen Rückfall auf eine andere Stufe: Parameter ohne passende Priorität bleiben leer, ein Hinweis nennt ihre Anzahl. Won't wird nie gewählt.
  - Ausgeblendete Werte bleiben erhalten.
- **Suche in der Matrix** (Suchfeld über der Matrix, `Strg+F`): markiert Parameter und Ausprägungen, deren Text oder Notiz die Eingabe enthält (ohne Groß-/Kleinschreibung und Akzente, auch im Bearbeiten-Modus), und blendet Zeilen ohne Treffer ab. Kategorie-Chips und eingeklappte Kategorien zeigen ihre Trefferzahl. `Enter`/`Umschalt+Enter` (oder die Pfeile) springen von Treffer zu Treffer und klappen dabei die Kategorie auf; `Esc` leert die Suche. Ein zweites `Strg+F` im Suchfeld öffnet die Suche des Browsers.
- Konzeptvergleich als **Tabelle** oder als **Verlauf** (Parallelkoordinaten: je Parameter eine Achse mit seinen Ausprägungen, je Konzept ein Linienzug; Legende zum Hervorheben und Auswählen, Tooltip je Parameter), ein- und ausklappbar (Ansicht und Zustand werden je Tab gemerkt; beim Drucken immer als Tabelle).
  - **Nur Unterschiede** blendet Parameter aus, bei denen alle Konzepte dasselbe gewählt haben (auch „nicht gewählt“ zählt als Wahl); die Anzahl der unterschiedlichen Parameter steht daneben.
  - **Sortierung** (bei aktivierter Bewertung): nach Nutzwert (höchster zuerst), Gesamtkosten (niedrigste zuerst) oder Preis-Leistung (beste zuerst), mit Rang vor dem Konzeptnamen; gleiche Werte teilen sich den Rang, unvollständig bewertete Konzepte stehen am Ende. Beides gilt für Tabelle und Verlauf und wird je Tab gemerkt.
- Rückgängig / Wiederholen (`Strg+Z`, `Strg+Umschalt+Z`).
- Automatisches Speichern im Browser (localStorage; beim Tippen nach einer kurzen Pause gebündelt, beim Verlassen eines Felds, Tab-Wechsel oder Schließen sofort), beliebig viele Matrizen unter **Datei → Meine Matrizen**.
- **Backup und Wiederherstellung** in „Meine Matrizen“: *Backup herunterladen* speichert alle Matrizen als ZIP-Archiv mit je einer JSON-Datei (jede einzeln wie mit „Als JSON speichern“ nutzbar). *Backup wiederherstellen* liest ein solches Archiv oder einzelne JSON-Dateien ein – ohne Datenverlust: neue Matrizen werden hinzugefügt, identische übersprungen, bei abweichendem Stand wird das Backup als Kopie „(aus Backup)“ angelegt.
- **Beispiele:** Mitgelieferte Beispiele lassen sich über **Datei → Beispiele …** oder **+ → Beispiel öffnen …** auswählen und öffnen sich als eigene Matrix in einem neuen Tab – derzeit *Kaffeemaschine* (Produktentwicklung mit Kosten, Nutzwerten, Notizen und Verträglichkeiten), *Skill-Matrix Frontend-Team* (Kompetenzen von Mitarbeitenden: Skills als Parameter, Stufen 0–3 als Ausprägungen, Personen als Konzepte), *Firmen-Event planen* (Event-Varianten nach Gesamtkosten und Zufriedenheit 0–5) *Elektro-Lastenrad* (umfangreich: 30 Parameter, 115 Ausprägungen, 7 Konzepte – gut zum Testen großer Matrizen), *Food-Truck gründen* (alle Bewertungsfunktionen: Startinvestition, Nutzwert, Gewichte, MoSCoW-Pfade MVP/Standard/Premium, Verträglichkeiten und ein Konzept mit absichtlichen Konflikten) und *Krimi plotten* (kreatives Schreiben ohne Zahlen: Verträglichkeiten sichern die Logik der Geschichte, „Zufällig“ wird zum Plot-Generator). Jedes Beispiel steht in einer eigenen Datei unter `examples/` – siehe [`examples/README.md`](examples/README.md).
- **Start-Menü am Logo:** Ein Klick auf das Logo öffnet ein Menü mit den Einstiegen *Neue leere Matrix*, *Beispiel öffnen*, *Meine Matrizen*, den zuletzt bearbeiteten Matrizen (öffnen sich als Tab bzw. wechseln zum vorhandenen) sowie *Hilfe & Tastenkürzel* und *Über die App*. Der Dialog „Hilfe & Über“ hat die Reiter *Erste Schritte*, *Tastenkürzel* (alle Kürzel der App auf einen Blick) und *Über*.
- **Tabs in der App:** Mehrere Matrizen sind gleichzeitig in Tabs in der Kopfzeile geöffnet. Jeder Tab behält Ansicht (Modus, Konzeptvergleich mit Darstellung, „Nur Unterschiede“ und Sortierung, eingeklappte Kategorien), Rückgängig-Verlauf und Scroll-Position. Über **+** lassen sich eine neue leere Matrix, ein Beispiel, ein JSON-Import, eine Matrix aus „Meine Matrizen“ oder ein zuletzt geschlossener Tab öffnen. Doppelklick auf den aktiven Tab benennt die Matrix um; Tabs lassen sich per Ziehen umsortieren und mit × oder der mittleren Maustaste schließen (die Matrix bleibt gespeichert). Geöffnete Tabs werden nach dem Neuladen wiederhergestellt; eine bereits geöffnete Matrix wird nicht doppelt geöffnet.
- **Mehrere Browser-Tabs:** Weiterhin möglich – jeder Browser-Tab hat seine eigenen App-Tabs. Ändert ein anderer Browser-Tab eine hier geöffnete Matrix, wird sie übernommen; inaktive Tabs werden dabei mit einem Punkt markiert.
- Export als JSON (`Strg+S`) und CSV (Excel-kompatibel), Import von JSON.
- Teilen per Link (die Matrix steckt komplett in der URL).
- Druckansicht bzw. PDF-Export über den Browser.
- Helles und dunkles Farbschema (folgt der Systemeinstellung).
- **Deutsch und Englisch (US):** beim ersten Start nach der Browsersprache, umschaltbar unter **Datei → Sprache**. Zahlen, Währung, Datum, Zahleneingabe und CSV-Export folgen der Sprache (Deutsch: `1.234,5` und CSV mit Semikolon; Englisch: `1,234.5` und CSV mit Komma). Die Inhalte der Matrizen werden nicht übersetzt.

## Dateien

| Datei / Ordner | Inhalt |
|---|---|
| `index.html` | Seitengerüst; bindet den Einstieg `js/ui/main.js` als Modul ein |
| `styles.css` | Design in Kaskaden-Ebenen (`@layer`): Tokens, Grundstile, Bausteine, Bereiche, Druck |
| `js/i18n/de.js`, `js/i18n/en.js` | Alle Texte der Oberfläche je Sprache – vom JavaScript erzeugte und unter `ui` die statischen Texte der Seite; `de.js` ist maßgeblich |
| `js/texts.js` | `Texts` (Texte der aktiven Sprache) und `Languages` (Sprachwahl) |
| `js/util.js` | `Util` – Zahlen, Texte, Kodierung (ohne DOM) |
| `js/model.js` | `Model` – Datenmodell, Normalisierung, Abfragen (ohne DOM) |
| `js/consistency.js` | `Consistency` – Verträglichkeiten: Konflikte, widerspruchsfreie Kombinationen zählen, Optimierung und Zufall unter Beachtung unverträglicher Paare (ohne DOM) |
| `js/count-worker.js` | Web Worker: zählt die widerspruchsfreien Kombinationen, ohne die Oberfläche zu blockieren |
| `js/evaluation.js` | `Evaluation` – Kosten, Nutzwert, Preis-Leistung, Prioritätsprofil, Kennzahlenbericht, automatische Konzepte (ohne DOM) |
| `js/ops.js` | `Ops` – strukturelle Änderungen an einer Matrix: Parameter, Ausprägungen, Kategorien, Konzepte (ohne DOM) |
| `js/io.js` | `IO` – JSON, CSV, Teilen-Links, Backup (ohne DOM) |
| `js/zip.js` | `Zip` – ZIP-Archive schreiben und lesen mit [fflate](https://github.com/101arrowz/fflate); wird erst beim Backup geladen (ohne DOM) |
| `js/storage.js` | `Store` – Speicherung im Browser (Bibliothek, geöffnete Tabs, Einstellungen pro Browser-Tab) |
| `js/examples.js` | `Examples` – Verzeichnis der mitgelieferten Beispiele (das erste fest eingebunden, die übrigen bei Bedarf nachgeladen) |
| `examples/` | Mitgelieferte Beispiele, je Beispiel eine JSON-Datei (Anleitung in `examples/README.md`) |
| `js/ui/` | Oberfläche (Preact-Komponenten in `.jsx`): `core` (Zustand, Verlauf, Neuzeichnen), `components` (Symbole, Logo), `dom` (Helfer fürs statische Gerüst, Positionierung schwebender Elemente), `tabs` (App-Tabs, Menü „+“), `actions`, `render-matrix` (Matrix, Kategorien), `render-panels` (Kennzahlen, Konzepte, Zusammenfassung, Vergleich), `render-chart` (Verlauf), `search` (Suche), `notes` (Notizen), `constraints` (Verträglichkeiten), `count` (Zählung im Worker), `start` (Start-Menü, Hilfe), `lines` (Verbindungslinien), `dialogs`, `main` (Einstieg) |
| `types.d.ts` | Typen des Datenmodells (nur Entwicklung) |
| `vite.config.js` | Build-Einstellungen (relative Pfade für GitHub Pages) und Einstellungen der Unit-Tests (Vitest) |
| `scripts/` | Hilfsskripte der Entwicklung (strenge Typprüfung der Logik) |
| `docs/DATENFORMAT.md` | Datenformat (JSON, Speicherung, Teilen-Links), Versionen und Migrationen |
| `tests/unit/` | Unit-Tests der Logik (`node:test`) |
| `tests/e2e/` | Browser-Tests (Playwright) |

**Texte und Sprachen:** Alle Texte stehen je Sprache in `js/i18n/` – `index.html` enthält nur Schlüssel (`data-i18n` für Text, `data-i18n-html` für Text mit Formatierung, `data-i18n-attr="title:…;aria-label:…"` für Attribute), die beim Start gefüllt werden. Formulierungen ändern betrifft also nur die Sprachdateien. `en.js` muss dieselbe Struktur wie `de.js` haben; das prüfen die Typprüfung und ein Unit-Test (`tests/unit/i18n.test.js`, auch für alle Schlüssel aus `index.html`). Eine weitere Sprache: Datei `js/i18n/<code>.js` nach dem Muster von `en.js` anlegen, in `js/texts.js` importieren und in `Languages` eintragen sowie im Menü (`data-lang`) ergänzen. Inhalte der Beispiele sind Daten und stehen je Beispiel in einer eigenen JSON-Datei unter `examples/`.

**Datenformat:** Gespeicherte Matrizen, JSON-Export und Teilen-Links tragen eine Formatversion; ältere Daten werden beim Öffnen automatisch umgewandelt, Daten aus einer neueren App-Version werden abgelehnt. Details in [`docs/DATENFORMAT.md`](docs/DATENFORMAT.md).

**Aufbau:** Alle Dateien sind ES-Module mit ausdrücklichen `import`/`export`; Vite bündelt sie für die Auslieferung. Die Logik-Dateien exportieren je einen Namensraum (`Util`, `Model`, `Consistency`, `Evaluation`, `Ops`, `IO`, `Zip`, `Store`) und arbeiten auf einer übergebenen Matrix statt auf globalem Zustand – so sind sie ohne Browser unit-testbar. Der Zustand des aktiven Tabs liegt in `js/ui/core.js`; andere Module lesen ihn über Importe und ändern ihn nur über die dortigen Funktionen. Änderungen an der Matrix laufen über `mutate()` (strukturell, mit Rückgängig; die eigentliche Änderung erledigt eine Funktion aus `Ops`), `fieldProps()` (Texteingaben) bzw. `setPref()` (Ansicht pro Tab) – siehe Kopfkommentar in `js/ui/core.js`.

**Oberfläche:** Die Bereiche der Seite sind Preact-Komponenten, die in ihre Container in `index.html` eingehängt werden. Die Matrix bleibt ein gewöhnliches Objekt; jede Änderung erhöht das Signal `revision` (über `render()`), und alle Komponenten, die es lesen, zeichnen neu – Preact gleicht nur die Unterschiede im DOM ab, sodass Fokus, Cursor und Bildlaufpositionen erhalten bleiben. Reiner Ansichtszustand (gewähltes Feld, offenes Popover, Hervorhebung, Suche) steht in eigenen Signalen. Gezeichnet wird sofort (`options.debounceRendering` in `main.js`), damit Code, der danach das DOM braucht (Fokus, Verbindungslinien), es vorfindet. Wichtig: Eine Komponente, die selbst ein Signal liest, zeichnet @preact/signals bei gleichen Props nicht mit ihrer Elternkomponente neu – sie muss dann zusätzlich `revision` lesen.

## Entwicklung

Entwicklungswerkzeuge (Node.js ≥ 22):

```sh
npm install                      # Werkzeuge installieren (einmalig)
npx playwright install chromium  # Browser für die Tests (einmalig)

npm run dev         # Entwicklungsserver (Vite)
npm run build       # Build nach dist/
npm run lint        # ESLint
npm run typecheck   # Typprüfung des JavaScript per JSDoc (tsc)
npm run test:unit   # Unit-Tests der Logik (Vitest, ohne Browser)
npm run coverage    # Unit-Tests mit Abdeckungsbericht je Datei
npm run test:e2e    # Browser-Tests (Playwright) gegen den Build (vite preview); vorher npm run build
npm test            # alles zusammen (inkl. Build)
```

- **Typen:** Das Datenmodell ist in `types.d.ts` beschrieben (nur für Editor und `tsc`, wird vom Browser nicht geladen). Die Skripte nutzen diese Typen über JSDoc-Kommentare; `tsc` prüft auch die Bezüge zwischen den Dateien.
- **Typprüfung in zwei Stufen:** `jsconfig.json` prüft den gesamten Code im `strict`-Modus (u. a. `null`/`undefined`-Prüfungen). `tsconfig.logic.json` verlangt für die DOM-freien Logik-Dateien unter `js/` zusätzlich Typangaben für alle Parameter (`noImplicitAny`); ausgenommen sind `js/texts.js` und die Sprachdateien unter `js/i18n/`, die nur Textbausteine enthalten (`scripts/typecheck-logic.js` filtert deren Meldungen aus).
- **Tests:** `tests/e2e/` prüft den Build, so wie er auf GitHub Pages läuft (Playwright startet dafür `vite preview`) – je Funktionsbereich eine Datei (Grundlagen, Speichern/Export, Backup, Sprachen, Beispiele, App-Tabs, mehrere Browser-Tabs, Bewertung, MoSCoW, automatische Konzepte, Kategorien, Reihenfolge). Jeder Test startet mit leerem Speicher und schlägt bei JavaScript-Fehlern der Seite fehl.
- **Unit-Tests:** `tests/unit/` prüft die DOM-freien Module mit Vitest (gleiche Vite-Konfiguration wie der Build, `vite.config.js`). Die App wählt ihre Sprache beim Laden; Standard in den Tests ist Deutsch (`tests/unit/setup.js`), `util-en.test.js` stellt per `vi.hoisted` auf Englisch um. Die automatischen Konzepte werden u. a. auf 300 Zufallsmatrizen gegen eine vollständige Durchrechnung geprüft. `npm run coverage` zeigt die Abdeckung je Datei (Zeilen, Zweige, Funktionen).
- **CI:** `.github/workflows/ci.yml` führt Lint, Typprüfung, Unit-Tests, Build und Browser-Tests bei jedem Pull Request aus.
- **Veröffentlichung:** `.github/workflows/pages.yml` baut die App bei jedem Push auf `main` und veröffentlicht `dist/` auf GitHub Pages (Einstellung des Repositorys: *Settings → Pages → Source: GitHub Actions*).
