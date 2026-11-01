// To add a palette, append one entry: { id, name, accent, darkAccent? }.
// All other shades (hover, soft backgrounds, borders, ink) are derived in styles.css from --accent.
export const PALETTES = [
  { id: "forest", name: "Bosc", accent: "#2d654f", darkAccent: "#5fae8a" },
  { id: "ocean", name: "Oceà", accent: "#2b5f8e", darkAccent: "#6aa7dc" },
  { id: "plum", name: "Pruna", accent: "#6d4a8a", darkAccent: "#b08ad0" },
  { id: "terracotta", name: "Terracota", accent: "#a2512f", darkAccent: "#e08a62" },
  { id: "slate", name: "Pissarra", accent: "#475569", darkAccent: "#94a3b8" }
];

export const MODES = [
  { id: "system", name: "Sistema" },
  { id: "light", name: "Clar" },
  { id: "dark", name: "Fosc" }
];

export const DEFAULT_APPEARANCE = { palette: PALETTES[0].id, mode: "system" };

export function normalizeAppearance(value) {
  return {
    palette: PALETTES.some(item => item.id === value?.palette) ? value.palette : DEFAULT_APPEARANCE.palette,
    mode: MODES.some(item => item.id === value?.mode) ? value.mode : DEFAULT_APPEARANCE.mode
  };
}

export function isValidAppearance(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    PALETTES.some(item => item.id === value.palette) && MODES.some(item => item.id === value.mode);
}

const darkQuery = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
let current = DEFAULT_APPEARANCE;

function resolveMode(mode) {
  return mode === "system" ? (darkQuery?.matches ? "dark" : "light") : mode;
}

export function applyAppearance(appearance) {
  current = normalizeAppearance(appearance);
  const palette = PALETTES.find(item => item.id === current.palette);
  const mode = resolveMode(current.mode);
  const root = document.documentElement;
  root.dataset.mode = mode;
  root.dataset.palette = palette.id;
  root.style.setProperty("--accent", mode === "dark" ? palette.darkAccent || palette.accent : palette.accent);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#121714" : "#f5f6f2");
}

darkQuery?.addEventListener("change", () => {
  if (current.mode === "system") applyAppearance(current);
});

export function appearanceFieldsMarkup(appearance, escape) {
  const { palette, mode } = normalizeAppearance(appearance);
  const option = (name, item, checked, extra = "") =>
    `<label class="appearance-option"><input type="radio" name="${name}" value="${escape(item.id)}"${checked ? " checked" : ""}>${extra}${escape(item.name)}</label>`;
  return `<div class="field full appearance-group" role="radiogroup" aria-label="Tema"><label>Tema</label><div class="appearance-options">${MODES.map(item => option("mode", item, item.id === mode)).join("")}</div></div>
    <div class="field full appearance-group" role="radiogroup" aria-label="Paleta de colors"><label>Paleta de colors</label><div class="appearance-options">${PALETTES.map(item => option("palette", item, item.id === palette, `<span class="palette-swatch" style="--swatch:${escape(item.accent)}"></span>`)).join("")}</div></div>`;
}
