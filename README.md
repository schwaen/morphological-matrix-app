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
- **Mehrere Tabs parallel:** Jeder Tab bearbeitet seine eigene Matrix und hat eigene Ansichtseinstellungen (Modus, Linien, Konzeptvergleich). „Neue Matrix“, „Beispiel laden“, Import und geteilte Links legen jeweils eine neue Matrix an, ohne andere Tabs zu verändern. Über „Neuer Tab“ in „Meine Matrizen“ lässt sich eine Matrix gezielt in einem weiteren Tab öffnen. Ist dieselbe Matrix in zwei Tabs geöffnet, werden Änderungen zwischen ihnen abgeglichen.
- Export als JSON (`Strg+S`) und CSV (Excel-kompatibel), Import von JSON.
- Teilen per Link (die Matrix steckt komplett in der URL).
- Druckansicht bzw. PDF-Export über den Browser.
- Helles und dunkles Farbschema (folgt der Systemeinstellung).

## Dateien

| Datei        | Inhalt                         |
|--------------|--------------------------------|
| `index.html` | Seitengerüst                   |
| `styles.css` | Design, Layout, responsive Regeln, Druck |
| `app.js`     | Datenmodell, Rendering, Logik  |
