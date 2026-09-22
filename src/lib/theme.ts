export const THEME_COOKIE = "rowgon_theme";
export const LEGACY_THEME_COOKIE = "tidework_theme";

export const DISPLAY_THEMES = [
  {
    id: "cool",
    label: "Cool mode",
    description: "Default teal foam — calm and coastal.",
  },
  {
    id: "light",
    label: "Light mode",
    description: "Airy whites with soft ink.",
  },
  {
    id: "bright",
    label: "Bright mode",
    description: "High-contrast daylight.",
  },
  {
    id: "gray",
    label: "Gray mode",
    description: "Neutral slate workspace.",
  },
  {
    id: "dark",
    label: "Deep Ocean",
    description: "Low-light deep tide workspace.",
  },
  {
    id: "burn",
    label: "Burn mode",
    description: "Warm ember accents.",
  },
] as const;

export type DisplayThemeId = (typeof DISPLAY_THEMES)[number]["id"];

export function isDisplayThemeId(value: string): value is DisplayThemeId {
  return DISPLAY_THEMES.some((t) => t.id === value);
}

export function parseDisplayTheme(raw: string | undefined | null): DisplayThemeId {
  if (raw && isDisplayThemeId(raw)) return raw;
  return "cool";
}
