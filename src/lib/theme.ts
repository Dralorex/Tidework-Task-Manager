export const THEME_COOKIE = "rowgon_theme";
export const LEGACY_THEME_COOKIE = "tidework_theme";
/** Once set, cookie value `burn` means dark-ember Burn (not the old soft theme). */
export const THEME_MIGRATION_COOKIE = "rowgon_theme_v2";

export type DisplayThemeGroup = "recommended" | "classic" | "fun" | "owners";

export const DISPLAY_THEME_GROUPS: {
  id: DisplayThemeGroup;
  label: string;
  description: string;
}[] = [
  {
    id: "recommended",
    label: "Recommended",
    description: "Core looks that fit everyday work.",
  },
  {
    id: "classic",
    label: "Classic",
    description: "Clean neutrals — white, gray, and true dark.",
  },
  {
    id: "fun",
    label: "Fun",
    description: "Beach, peach, and ember for a bolder vibe.",
  },
  {
    id: "owners",
    label: "Owner's Choice",
    description: "A stark signature look — pure black and blood red.",
  },
];

export const DISPLAY_THEMES = [
  {
    id: "cool",
    label: "Cool mode",
    description: "Default teal foam — calm and coastal.",
    group: "recommended",
  },
  {
    id: "dark",
    label: "Deep Ocean",
    description: "Low-light deep tide workspace.",
    group: "recommended",
  },
  {
    id: "light",
    label: "Light mode",
    description: "Pure white — no color washes.",
    group: "classic",
  },
  {
    id: "gray",
    label: "Gray mode",
    description: "Mid slate workspace.",
    group: "classic",
  },
  {
    id: "night",
    label: "Dark mode",
    description: "Classic flat dark — no accent washes.",
    group: "classic",
  },
  {
    id: "beach",
    label: "Beach mode",
    description: "Wavy sky, water, and sand.",
    group: "fun",
  },
  {
    id: "peach",
    label: "Peach mode",
    description: "Soft peach canvas with warm accents.",
    group: "fun",
  },
  {
    id: "burn",
    label: "Burn mode",
    description: "Dark ember — red, yellow, and orange heat.",
    group: "fun",
  },
  {
    id: "owners",
    label: "Owner's Choice",
    description: "Pure black with maroon blood-red lines and text.",
    group: "owners",
  },
] as const;

export type DisplayThemeId = (typeof DISPLAY_THEMES)[number]["id"];

const THEME_IDS = new Set<string>(DISPLAY_THEMES.map((t) => t.id));

/** Legacy cookie values → current ids (before / without v2 migration). */
const LEGACY_THEME_ALIASES: Record<string, DisplayThemeId> = {
  bright: "beach",
  /** Pre-v2 `burn` was the soft warm look; now Peach. */
  burn: "peach",
};

export function isDisplayThemeId(value: string): value is DisplayThemeId {
  return THEME_IDS.has(value);
}

/**
 * Resolve cookie → theme.
 * - `bright` always → beach
 * - `burn` → peach until v2 migration cookie is set; after that `burn` is dark ember
 */
export function parseDisplayTheme(
  raw: string | undefined | null,
  opts?: { migratedV2?: boolean },
): DisplayThemeId {
  if (!raw) return "cool";

  if (raw === "bright") return "beach";

  if (raw === "burn") {
    return opts?.migratedV2 ? "burn" : "peach";
  }

  if (isDisplayThemeId(raw)) return raw;

  const aliased = LEGACY_THEME_ALIASES[raw];
  if (aliased) return aliased;

  return "cool";
}

export function themesInGroup(group: DisplayThemeGroup) {
  return DISPLAY_THEMES.filter((t) => t.group === group);
}
