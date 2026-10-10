/**
 * Typen des Datenmodells – nur für die Typprüfung (tsc/Editor), wird vom Browser nicht geladen.
 * Die Struktur entspricht dem JSON-Export einer Matrix.
 */

interface MatrixOption {
  id: string;
  text: string;
  /** Kosten in der Währung der Matrix, `null` = nicht erfasst */
  cost: number | null;
  /** Erfüllungsgrad je Kriterium (`settings.criteria`) auf der Skala `settings.utilityMax`; fehlt = nicht bewertet */
  scores: Record<string, number>;
  /** Priorität nach MoSCoW, `null` = nicht festgelegt */
  priority: MatrixPriority | null;
  /** Notiz (Freitext, optional leer) */
  note: string;
  /** Werte der eigenen Merkmale (`settings.attributes`), Merkmal-ID → Wert; fehlt = nicht erfasst */
  values: Record<string, AttributeValue>;
}

/** Wert eines Merkmals: Zahl, Stufen-ID (Auswahl), Ja/Nein oder Text */
type AttributeValue = number | string | boolean;

/** Form eines Merkmals: Ganzzahl, Dezimalzahl, Auswahl aus Stufen, Ja/Nein, Text */
type AttributeType = 'int' | 'decimal' | 'choice' | 'bool' | 'text';

/** Zusammenfassung je Konzept; bei Auswahl `max` = höchste, `min` = niedrigste Stufe */
type AttributeAggregate = 'sum' | 'min' | 'max' | 'avg' | 'none' | 'count' | 'list';

/** Grenze, ab der der Vergleich warnt (Zahl über/unter einem Wert, ab einer Stufe, nicht alle Ja) */
type AttributeLimit =
  | { op: 'above' | 'below', value: number }
  | { op: 'level', value: string }
  | { op: 'allYes' };

/** Stufe eines Auswahl-Merkmals (Reihenfolge = Rangfolge) */
interface AttributeLevel {
  id: string;
  name: string;
}

/** Eigenes Merkmal der Ausprägungen – beschreibend, geht nicht in den Nutzwert ein */
interface MatrixAttribute {
  id: string;
  /** leer = „Merkmal n“ */
  name: string;
  description: string;
  /** Messverfahren bzw. Quelle der Werte */
  source: string;
  type: AttributeType;
  /** Einheit (nur Zahlen, sonst leer) */
  unit: string;
  /** Nachkommastellen (Dezimalzahl 1–3, sonst 0) */
  decimals: number;
  /** Stufen (nur Auswahl, sonst leer) */
  levels: AttributeLevel[];
  aggregate: AttributeAggregate;
  /** `null` = keine Grenze */
  limit: AttributeLimit | null;
}

/** Zusammenfassung eines Merkmals für ein Konzept (`Attributes.summarize`) */
interface AttributeSummary {
  /** Parameter, in denen mindestens eine Ausprägung einen Wert hat */
  relevant: number;
  /** davon nicht gewählt oder ohne Wert */
  missing: number;
  /** gewählte Ausprägungen mit Wert */
  filled: number;
  /** Anzeige (leer = kein Wert) */
  text: string;
  /** Sortierwert, `null` = keiner */
  sort: number | null;
  /** Grenze überschritten */
  warn: boolean;
}

/** MoSCoW: Must have, Should have, Could have, Won't have */
type MatrixPriority = 'must' | 'should' | 'could' | 'wont';

interface MatrixParameter {
  id: string;
  name: string;
  /** Beschreibung (Freitext, optional leer) */
  note: string;
  /** Gewichtung für den Nutzwert, `null` = Standard 1 */
  weight: number | null;
  /** Zugeordnete Kategorie, `null` = ohne Kategorie */
  categoryId: string | null;
  options: MatrixOption[];
}

interface MatrixCategory {
  id: string;
  name: string;
  color: string;
}

/** Status eines Konzepts: Entwurf, Favorit (in engerer Wahl), verworfen, gewählt */
type ConceptStatus = 'draft' | 'favorite' | 'dropped' | 'chosen';

interface MatrixConcept {
  id: string;
  name: string;
  color: string;
  /** Begründung / Notiz (Freitext, optional leer) */
  note: string;
  /** Stand der Entscheidung */
  status: ConceptStatus;
  /** Grund zum Status, z. B. warum verworfen (Freitext, optional leer) */
  statusNote: string;
  /** Parameter-ID → gewählte Ausprägungs-ID */
  selections: Record<string, string>;
}

/** Verträglichkeit eines Paars: unverträglich bzw. bedingt verträglich (fehlt = verträglich) */
type MatrixConstraintType = 'excluded' | 'conditional';

/** Paar aus zwei Ausprägungen verschiedener Parameter (`a < b`) */
interface MatrixConstraint {
  a: string;
  b: string;
  type: MatrixConstraintType;
  /** Begründung (optional, leer = keine) */
  note: string;
}

interface MatrixSettings {
  costs: boolean;
  utility: boolean;
  currency: 'EUR' | 'USD' | 'CHF' | 'GBP';
  utilityMax: 5 | 10 | 100;
  /** Priorität (MoSCoW) je Ausprägung erfassen */
  moscow: boolean;
  /** Kriterien des Nutzwerts (mindestens eines); der Nutzwert einer Ausprägung ist ihr gewichtetes Mittel */
  criteria: MatrixCriterion[];
  /** Eigene Merkmale der Ausprägungen (beschreibend, nicht Teil des Nutzwerts) */
  attributes: MatrixAttribute[];
}

/** Kriterium der Nutzwertanalyse; `weight` ist relativ (wird auf 100 % umgerechnet) */
interface MatrixCriterion {
  id: string;
  /** leer = „Nutzwert“ */
  name: string;
  weight: number;
}

interface Matrix {
  version: number;
  title: string;
  description: string;
  settings: MatrixSettings;
  categories: MatrixCategory[];
  /** Immer nach Kategorien gruppiert sortiert (siehe `sortedByCategory`) */
  parameters: MatrixParameter[];
  concepts: MatrixConcept[];
  /** Verträglichkeiten zwischen Ausprägungen (nur nicht verträgliche Paare) */
  constraints: MatrixConstraint[];
  activeConceptId: string | null;
}

/** Mitgeliefertes Beispiel (eine JSON-Datei je Beispiel unter examples/) */
interface ExampleDef {
  /** Eindeutiger Kurzname, z. B. Dateiname ohne Endung */
  id: string;
  /** Anzeigename in der Auswahl */
  name: string;
  /** Kurze Beschreibung in der Auswahl */
  description?: string;
  /** Matrix im Format des JSON-Exports (docs/DATENFORMAT.md) */
  data: object;
}

/** Ansichtseinstellungen pro Tab (sessionStorage) */
interface TabPrefs {
  mode: 'edit' | 'select';
  /** Verbindungslinien: alle Konzepte, nur das aktive kräftig (andere dezent) oder keine */
  lines: 'all' | 'active' | 'off';
  /** Frühere Einstellung (an/aus) – wird beim Laden in `lines` übernommen */
  showLines?: boolean;
  compareOpen: boolean;
  /** Konzeptvergleich als Tabelle oder Verlaufsdiagramm */
  compareView?: 'table' | 'chart' | 'scatter';
  /** Konzeptvergleich: nur Parameter zeigen, bei denen sich die Konzepte unterscheiden */
  compareDiff?: boolean;
  /** Konzeptvergleich: Reihenfolge der Konzepte (`order` = wie in der Liste) */
  compareSort?: 'order' | 'utility' | 'cost' | 'priceValue' | `attr:${string}:${'asc' | 'desc'}`;
  /** Konzeptvergleich: Konzepte mit unverträglichem Paar ausblenden */
  compareHideConflicts?: boolean;
  /** Konzeptvergleich: verworfene Konzepte ausblenden */
  compareHideDropped?: boolean;
  /** Kategorie-ID (bzw. `__none`) → eingeklappt */
  collapsed?: Record<string, boolean>;
}

/** Ansicht eines App-Tabs (wird beim Wechsel gemerkt) */
interface TabView {
  mode: TabPrefs['mode'];
  compareOpen: boolean;
  compareView?: TabPrefs['compareView'];
  compareDiff?: boolean;
  compareSort?: TabPrefs['compareSort'];
  compareHideConflicts?: boolean;
  compareHideDropped?: boolean;
  collapsed?: Record<string, boolean>;
}

/** Geöffnete App-Tabs eines Browser-Tabs (sessionStorage, Vorgabe für neue Browser-Tabs im localStorage) */
interface Workspace {
  tabs: Array<{ docId: string, view?: Partial<TabView> }>;
  active: string | null;
  /** Zuletzt geschlossene Matrizen (neueste zuerst) */
  closed?: string[];
}

/** Kennzahlen eines Konzepts (`Evaluation.conceptReport`); `null` = Bewertung nicht aktiv */
interface ConceptFigures {
  concept: MatrixConcept;
  /** Gesamtkosten; `missing` = gewählte Ausprägungen ohne Kosten */
  cost: { total: number, missing: number, best: boolean } | null;
  /** Gewichteter Nutzwert; `missing` = gewählte Ausprägungen ohne Nutzwert */
  utility: { value: number | null, missing: number, best: boolean } | null;
  /** Kosten je Nutzwertpunkt; `reason` erklärt, warum nicht berechenbar */
  priceValue: { value: number | null, reason: string | null, best: boolean } | null;
  /** Anzahl gewählter Ausprägungen je Priorität (MoSCoW) */
  priority: Record<MatrixPriority | 'none', number> | null;
}

/** Inhalt des Konzeptvergleichs (Reihenfolge, Rang, ggf. nur Parameter mit Unterschieden) */
interface CompareContent {
  ranked: Array<{ figures: ConceptFigures, rank: number | null }>;
  groups: Array<{ cat: MatrixCategory | null, items: Array<{ p: MatrixParameter, pi: number }> }>;
  /** `true`, wenn nur Parameter mit Unterschieden gezeigt werden */
  filtered: boolean;
}

/** Ausprägung samt Parameter und Positionen (`Model.findOption`, `Model.optionIndex`) */
interface OptionRef {
  p: MatrixParameter;
  /** Position des Parameters in `parameters` */
  pi: number;
  o: MatrixOption;
  /** Position der Ausprägung im Parameter */
  oi: number;
}

/**
 * Ein geöffneter App-Tab. Für inaktive Tabs liegen Matrix, Verlauf und Scroll-Position hier;
 * für den aktiven Tab gelten die Variablen in js/ui/core.js.
 */
interface AppTab {
  docId: string;
  view: Partial<TabView>;
  state?: Matrix;
  undo?: string[];
  redo?: string[];
  lastSaved?: string | null;
  scrollY?: number;
  external?: boolean;
}

/** Bestandteile des Berichts (js/report.js, Dialog „Exportieren“) */
type ReportParts = {
  facts: boolean;
  concepts: boolean;
  /** verworfene Konzepte weglassen (in Konzepten, Vergleich, Diagramm und Matrix) */
  hideDropped: boolean;
  compare: boolean;
  evaluation: boolean;
  /** Kosten/Nutzen-Diagramm (nur HTML, nur mit Kosten und Nutzwert) */
  chart: boolean;
  matrix: boolean;
  constraints: boolean;
};
