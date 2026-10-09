/*
 * Kleine, überall genutzte Bausteine der Oberfläche (Preact-Komponenten).
 */

/** Pfade der Symbole (24er-Raster, nur Kontur). */
const ICONS = {
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5M8.5 9h7M8.5 12.5h4',
  ban: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M5.6 5.6l12.8 12.8',
};

/** @typedef {keyof typeof ICONS} IconName */

/** Symbol als SVG (für Screenreader verborgen). @param {{ name: IconName }} props */
export function Icon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}

/**
 * Knopf nur mit Symbol; die Beschriftung steht in `title` und `aria-label`.
 * @param {{ icon: IconName, label: string, onClick: (e: MouseEvent) => void, disabled?: boolean,
 *           danger?: boolean, small?: boolean, active?: boolean, class?: string, [attr: string]: any }} props
 */
export function IconButton({ icon, label, onClick, disabled = false, danger = false, small = true, active = false, class: extra = '', ...rest }) {
  const cls = `icon-btn${small ? ' small' : ''}${danger ? ' danger' : ''}${active ? ' is-on' : ''}${extra ? ` ${extra}` : ''}`;
  return (
    <button type="button" class={cls} title={label} aria-label={label} disabled={disabled} onClick={onClick} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

/** Raster mit je einer gewählten Zelle pro Zeile (Ausprägung je Parameter), verbunden durch die Konzeptlinie. */
const LOGO_CELLS = [[0, 0], [1, 2], [2, 1]];
const LOGO_POS = [5.5, 13.3, 21.1];

/** Logo der App (Kopfzeile, Start-Menü, Hilfe); Hintergrund in der Akzentfarbe (`currentColor`). */
export function Logo() {
  const cell = (/** @type {number} */ r, /** @type {number} */ c) => (
    <rect key={`${r}:${c}`} x={LOGO_POS[c]} y={LOGO_POS[r]} width="5.6" height="5.6" rx="1.5" />
  );
  const chosen = (/** @type {number} */ r, /** @type {number} */ c) => LOGO_CELLS.some(([a, b]) => a === r && b === c);
  return (
    <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <g fill="#fff" opacity=".32">{[0, 1, 2].flatMap(r => [0, 1, 2].filter(c => !chosen(r, c)).map(c => cell(r, c)))}</g>
      <g fill="#fff">{LOGO_CELLS.map(([r, c]) => cell(r, c))}</g>
      <path d="M8.3 11.1C8.3 12.2 23.9 12.2 23.9 13.3M23.9 18.9C23.9 20 16.1 20 16.1 21.1" fill="none" stroke="#fb923c" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  );
}
