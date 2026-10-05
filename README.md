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
- **Kombinieren-Modus:** Lösungskonzepte bilden, indem je Parameter eine Ausprägung angeklickt wird. Jedes Konzept hat eine eigene Farbe; die Auswahl wird durch Verbindungslinien dargestellt.
- Konzepte anlegen, duplizieren, umbenennen, umfärben, zufällig befüllen.
- Kennzahlen: Anzahl Parameter, Ausprägungen und mögliche Kombinationen.
- **Optionale Bewertung** (pro Matrix über **Datei → Bewertung: Kosten & Nutzwert** zuschaltbar, standardmäßig aus):
  - **Kosten** je Ausprägung in wählbarer Währung (EUR, USD, CHF, GBP); je Konzept werden die Gesamtkosten summiert.
  - **Nutzwert** je Ausprägung als Erfüllungsgrad (Skala 0–5, 0–10 oder 0–100) und optionale **Gewichtung** je Parameter (Standard 1). Der Nutzwert eines Konzepts ist wie in der Nutzwertanalyse Σ(Gewicht × Erfüllungsgrad) / Σ Gewichte; nicht gewählte oder unbewertete Parameter zählen mit 0.
  - Ergebnisse in der Konzeptzusammenfassung und im Konzeptvergleich (bester Wert hervorgehoben, unvollständige Werte mit * markiert) sowie im CSV-Export.
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
| `styles.css` | Layout, responsive Regeln, Druck |
| `app.js`     | Datenmodell, Rendering, Logik  |
