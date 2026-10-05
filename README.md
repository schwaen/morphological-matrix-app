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
- Konzeptvergleich als Tabelle, ein- und ausklappbar (Zustand wird gemerkt; beim Drucken immer sichtbar).
- Rückgängig / Wiederholen (`Strg+Z`, `Strg+Umschalt+Z`).
- Automatisches Speichern im Browser (localStorage).
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
