/**
 * Colour themes. Each one is a complete set of CSS variable values (HSL triplets), applied inline
 * to <html> (and to the preview in Settings) so any theme can be combined with any UI style.
 */
export type ThemeId =
  | "system" | "light" | "sand"
  | "dark" | "midnight" | "ocean" | "forest" | "plum" | "crimson" | "ember"
  | "graphite" | "amoled" | "nord" | "dracula" | "mocha" | "tokyo" | "gruvbox" | "solarized"
  // Colours that match a platform's UI style (see uiStyle.ts)
  | "adwaita" | "adwaita-dark" | "breeze" | "breeze-dark" | "win11" | "win11-dark" | "win10" | "win10-dark"
  | "win7" | "win7-dark" | "winxp" | "win98" | "macos" | "macos-dark" | "material" | "material-dark";

export type Hsl = [number, number, number];
export type Motif = "stars" | "waves" | "hills" | "grid" | "dots" | "rays" | "peaks";

export type ThemeDef = {
  id: Exclude<ThemeId, "system">;
  label: string;
  dark: boolean;
  /** Accent colour, as [h, s, l]. */
  primary: Hsl;
  vars: Record<string, string>;
  motif: Motif;
};

const t = (h: number, s: number, l: number) => `${h} ${s}% ${l}%`;

/** "#rrggbb" -> [h, s, l]. Lets platform colours be written the way their designers publish them. */
export const hex = (value: string): Hsl => {
  const n = parseInt(value.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(((h * 60) + 360) % 360), Math.round(s * 100), Math.round(l * 1000) / 10];
};
const hx = (value: string) => t(...hex(value));

type Spec = {
  id: ThemeDef["id"];
  label: string;
  /** Background hue / saturation / lightness */
  bg: Hsl;
  primary: Hsl;
  /** Text on the accent colour; defaults to white (dark text for light accents). */
  onPrimary?: string;
  fg?: string;
  mutedFg?: string;
  motif: Motif;
  /** How much lighter surfaces get as they stack up (dark themes) */
  step?: number;
  /** Exact values (hex) for individual variables, for themes that copy a real palette. */
  ov?: Partial<Record<"card" | "popover" | "secondary" | "muted" | "accent" | "border" | "input" | "mutedFg" | "fg", string>>;
};

/** Applies a spec's exact colour overrides on top of the derived ones. */
const applyOverrides = (vars: Record<string, string>, ov: Spec["ov"]) => {
  if (!ov) return vars;
  const map: Record<string, string> = {
    card: "card", popover: "popover", secondary: "secondary", muted: "muted", accent: "accent", border: "border", input: "input", mutedFg: "muted-foreground", fg: "foreground",
  };
  for (const [k, v] of Object.entries(ov)) {
    if (!v) continue;
    vars[map[k]] = hx(v);
    if (k === "fg") for (const x of ["card-foreground", "popover-foreground", "secondary-foreground", "accent-foreground"]) vars[x] = hx(v);
    if (k === "card" && !ov.popover) vars.popover = hx(v);
  }
  return vars;
};

const dark = (s: Spec): ThemeDef => {
  const [h, sat, l] = s.bg;
  const k = s.step ?? 1;
  const light = s.primary[2] > 62;
  return {
    id: s.id, label: s.label, dark: true, primary: s.primary, motif: s.motif,
    vars: applyOverrides({
      background: t(h, sat, l),
      foreground: s.fg ?? t(h, Math.min(sat, 30), 95),
      card: t(h, sat, l + 4.5 * k),
      "card-foreground": s.fg ?? t(h, Math.min(sat, 30), 95),
      popover: t(h, sat, l + 4.5 * k),
      "popover-foreground": s.fg ?? t(h, Math.min(sat, 30), 95),
      primary: t(...s.primary),
      "primary-foreground": s.onPrimary ?? (light ? t(h, 40, 10) : "0 0% 100%"),
      secondary: t(h, Math.min(sat, 30), l + 10 * k),
      "secondary-foreground": s.fg ?? t(h, Math.min(sat, 30), 95),
      muted: t(h, Math.min(sat, 30), l + 10 * k),
      "muted-foreground": s.mutedFg ?? t(h, Math.min(sat, 16), 68),
      accent: t(h, Math.min(sat, 30), l + 15 * k),
      "accent-foreground": s.fg ?? t(h, Math.min(sat, 30), 95),
      destructive: "0 62.8% 40%",
      "destructive-foreground": "0 0% 98%",
      border: t(h, Math.min(sat, 30), l + 11 * k),
      input: t(h, Math.min(sat, 30), l + 15 * k),
      ring: t(s.primary[0], s.primary[1], Math.min(s.primary[2] + 4, 80)),
      positive: "142 69% 58%",
      negative: "0 91% 71%",
    }, s.ov),
  };
};

const light = (s: Spec): ThemeDef => {
  const [h, sat, l] = s.bg;
  const fg = s.fg ?? t(222, 47, 11);
  return {
    id: s.id, label: s.label, dark: false, primary: s.primary, motif: s.motif,
    vars: applyOverrides({
      background: t(h, sat, l),
      foreground: fg,
      card: t(h, sat, Math.min(l + 3.5, 100)),
      "card-foreground": fg,
      popover: t(h, sat, Math.min(l + 3.5, 100)),
      "popover-foreground": fg,
      primary: t(...s.primary),
      "primary-foreground": s.onPrimary ?? "0 0% 100%",
      secondary: t(h, sat, l - 4.5),
      "secondary-foreground": fg,
      muted: t(h, sat, l - 4),
      "muted-foreground": s.mutedFg ?? t(h, 14, 38),
      accent: t(h, sat, l - 9),
      "accent-foreground": fg,
      destructive: "0 84.2% 60.2%",
      "destructive-foreground": "210 40% 98%",
      border: t(h, sat, l - 9),
      input: t(h, sat, l - 12),
      ring: t(...s.primary),
      positive: "142 71% 30%",
      negative: "0 72% 45%",
    }, s.ov),
  };
};

export const THEME_DEFS: ThemeDef[] = [
  light({ id: "light", label: "Light", bg: [210, 40, 96.5], primary: [221, 83, 48], fg: "222 84% 5%", mutedFg: "215 16% 42%", motif: "waves" }),
  light({ id: "sand", label: "Sand", bg: [40, 33, 95], primary: [28, 90, 40], fg: "28 30% 12%", mutedFg: "30 14% 36%", motif: "hills" }),
  dark({ id: "dark", label: "Dark", bg: [222, 47, 5], primary: [217, 91, 55], motif: "grid" }),
  dark({ id: "midnight", label: "Midnight", bg: [232, 50, 6], primary: [243, 85, 67], motif: "stars" }),
  dark({ id: "ocean", label: "Ocean", bg: [200, 60, 6], primary: [188, 85, 42], motif: "waves" }),
  dark({ id: "forest", label: "Forest", bg: [160, 35, 5], primary: [152, 69, 38], motif: "peaks" }),
  dark({ id: "plum", label: "Plum", bg: [285, 35, 6], primary: [322, 75, 52], motif: "dots" }),
  dark({ id: "crimson", label: "Crimson", bg: [350, 40, 6], primary: [351, 78, 52], motif: "rays" }),
  dark({ id: "ember", label: "Ember", bg: [22, 40, 6], primary: [24, 94, 52], motif: "peaks" }),
  dark({ id: "graphite", label: "Graphite", bg: [220, 8, 9], primary: [213, 60, 58], motif: "grid", step: 0.9 }),
  dark({ id: "amoled", label: "AMOLED black", bg: [0, 0, 0], primary: [190, 90, 50], motif: "stars", step: 1.4 }),
  dark({ id: "nord", label: "Nord", bg: [220, 16, 17], primary: [193, 43, 67], fg: "218 27% 94%", mutedFg: "219 15% 70%", motif: "peaks", step: 1.1 }),
  dark({ id: "dracula", label: "Dracula", bg: [231, 15, 15], primary: [265, 89, 72], fg: "60 30% 96%", mutedFg: "225 20% 72%", motif: "dots", step: 1.1 }),
  dark({ id: "mocha", label: "Mocha", bg: [240, 21, 11], primary: [267, 84, 78], fg: "226 64% 88%", mutedFg: "228 24% 72%", motif: "hills", step: 1.1 }),
  dark({ id: "tokyo", label: "Tokyo Night", bg: [235, 22, 9], primary: [222, 89, 70], fg: "229 35% 82%", mutedFg: "229 20% 62%", motif: "stars", step: 1.1 }),
  dark({ id: "gruvbox", label: "Gruvbox", bg: [0, 0, 12], primary: [42, 95, 55], fg: "43 59% 81%", mutedFg: "40 20% 62%", motif: "hills", step: 1.1 }),
  dark({ id: "solarized", label: "Solarized Dark", bg: [193, 100, 9], primary: [205, 69, 49], fg: "44 87% 94%", mutedFg: "186 13% 62%", motif: "waves", step: 1.2 }),

  // ---- Platform palettes (pair with the matching UI style) ----
  light({ id: "adwaita", label: "Adwaita", bg: hex("#fafafb"), primary: hex("#3584e4"), fg: hx("#2e3436"), mutedFg: hx("#5e5c64"), motif: "hills",
    ov: { card: "#ffffff", secondary: "#ebebed", muted: "#ebebed", accent: "#e1e1e4", border: "#d8d8dc", input: "#cfcfd4" } }),
  dark({ id: "adwaita-dark", label: "Adwaita Dark", bg: hex("#242424"), primary: hex("#3584e4"), onPrimary: "0 0% 100%", fg: "0 0% 100%", mutedFg: hx("#c0bfbc"), motif: "hills",
    ov: { card: "#303030", secondary: "#3a3a3a", muted: "#383838", accent: "#464646", border: "#3d3d3d", input: "#4a4a4a" } }),
  light({ id: "breeze", label: "Breeze", bg: hex("#eff0f1"), primary: hex("#3daee9"), onPrimary: hx("#ffffff"), fg: hx("#31363b"), mutedFg: hx("#6f7479"), motif: "waves",
    ov: { card: "#fcfcfc", secondary: "#e3e5e7", muted: "#e3e5e7", accent: "#d6e9f5", border: "#bcc0c4", input: "#bcc0c4" } }),
  dark({ id: "breeze-dark", label: "Breeze Dark", bg: hex("#31363b"), primary: hex("#3daee9"), onPrimary: hx("#1b1e20"), fg: hx("#eff0f1"), mutedFg: hx("#a1a9b1"), motif: "waves",
    ov: { card: "#232629", secondary: "#3b4045", muted: "#3b4045", accent: "#2f5e7a", border: "#4d5359", input: "#4d5359" } }),
  light({ id: "win11", label: "Windows 11", bg: hex("#f3f3f3"), primary: hex("#005fb8"), fg: hx("#1a1a1a"), mutedFg: hx("#5d5d5d"), motif: "waves",
    ov: { card: "#fbfbfb", secondary: "#ededed", muted: "#ededed", accent: "#e5e5e5", border: "#e0e0e0", input: "#c9c9c9" } }),
  dark({ id: "win11-dark", label: "Windows 11 Dark", bg: hex("#202020"), primary: hex("#4cc2ff"), onPrimary: "0 0% 0%", fg: "0 0% 100%", mutedFg: hx("#c5c5c5"), motif: "waves",
    ov: { card: "#2b2b2b", secondary: "#323232", muted: "#323232", accent: "#3a3a3a", border: "#3b3b3b", input: "#5a5a5a" } }),
  light({ id: "win10", label: "Windows 10", bg: hex("#ffffff"), primary: hex("#0078d7"), fg: hx("#000000"), mutedFg: hx("#666666"), motif: "grid",
    ov: { card: "#f2f2f2", secondary: "#e6e6e6", muted: "#e6e6e6", accent: "#cce4f7", border: "#cccccc", input: "#7a7a7a" } }),
  dark({ id: "win10-dark", label: "Windows 10 Dark", bg: hex("#1f1f1f"), primary: hex("#0078d7"), onPrimary: "0 0% 100%", fg: "0 0% 100%", mutedFg: hx("#b3b3b3"), motif: "grid",
    ov: { card: "#2b2b2b", secondary: "#333333", muted: "#333333", accent: "#404040", border: "#404040", input: "#7a7a7a" } }),
  // Aero: pale glass blue desktop, #f0f0f0 control surfaces, #3399ff selection, #707070 control borders
  light({ id: "win7", label: "Windows 7", bg: hex("#d4e3f5"), primary: hex("#2f6db5"), fg: hx("#1a2a3d"), mutedFg: hx("#566a82"), motif: "waves",
    ov: { card: "#f0f4fa", secondary: "#e3ebf5", muted: "#e3ebf5", accent: "#cfe2f7", border: "#8fa9c8", input: "#7b8da3" } }),
  // A darkened Aero: smoked-glass navy with the same blue highlights
  dark({ id: "win7-dark", label: "Windows 7 Dark", bg: hex("#0d1521"), primary: hex("#4a90d9"), onPrimary: "0 0% 100%", fg: hx("#e3edf9"), mutedFg: hx("#8fa6c2"), motif: "waves",
    ov: { card: "#17222f", secondary: "#1f2d3e", muted: "#1c2939", accent: "#27425f", border: "#33506f", input: "#3d5a7b" } }),
  // Luna (blue): #ece9d8 dialogs, white inputs, #0054e3 title bars
  light({ id: "winxp", label: "Windows XP", bg: hex("#ece9d8"), primary: hex("#245edb"), fg: hx("#000000"), mutedFg: hx("#595959"), motif: "hills",
    ov: { card: "#ffffff", secondary: "#e2dfcd", muted: "#e2dfcd", accent: "#c1d2ee", border: "#aca899", input: "#7f9db9" } }),
  // Classic: teal desktop, #c0c0c0 windows, navy title bars
  light({ id: "win98", label: "Windows 98", bg: hex("#008080"), primary: hex("#000080"), fg: hx("#000000"), mutedFg: hx("#404040"), motif: "grid",
    ov: { card: "#c0c0c0", secondary: "#d4d0c8", muted: "#d4d0c8", accent: "#a6a6a6", border: "#808080", input: "#808080" } }),
  light({ id: "macos", label: "macOS", bg: hex("#f5f5f7"), primary: hex("#007aff"), fg: hx("#1d1d1f"), mutedFg: hx("#6e6e73"), motif: "hills",
    ov: { card: "#ffffff", secondary: "#ececf0", muted: "#ececf0", accent: "#e1e1e6", border: "#d6d6db", input: "#c7c7cc" } }),
  dark({ id: "macos-dark", label: "macOS Dark", bg: hex("#1e1e1e"), primary: hex("#0a84ff"), onPrimary: "0 0% 100%", fg: hx("#f5f5f7"), mutedFg: hx("#98989d"), motif: "hills",
    ov: { card: "#2a2a2c", secondary: "#3a3a3c", muted: "#323234", accent: "#48484a", border: "#3d3d40", input: "#545458" } }),
  light({ id: "material", label: "Material You", bg: hex("#fef7ff"), primary: hex("#6750a4"), fg: hx("#1d1b20"), mutedFg: hx("#49454f"), motif: "dots",
    ov: { card: "#f7f2fa", secondary: "#e8def8", muted: "#ece6f0", accent: "#e8def8", border: "#cac4d0", input: "#79747e" } }),
  dark({ id: "material-dark", label: "Material You Dark", bg: hex("#141218"), primary: hex("#d0bcff"), onPrimary: hx("#381e72"), fg: hx("#e6e0e9"), mutedFg: hx("#cac4d0"), motif: "dots",
    ov: { card: "#211f26", secondary: "#4a4458", muted: "#2b2930", accent: "#4a4458", border: "#49454f", input: "#938f99" } }),
];

export const THEMES: { id: ThemeId; label: string; dark: boolean | null }[] = [
  { id: "system", label: "System", dark: null },
  ...THEME_DEFS.map((d) => ({ id: d.id as ThemeId, label: d.label, dark: d.dark })),
];

/** Themes that copy a platform's palette, shown in their own group in Settings. */
export const PLATFORM_THEME_IDS: ThemeId[] = [
  "adwaita", "adwaita-dark", "breeze", "breeze-dark", "win11", "win11-dark", "win10", "win10-dark",
  "win7", "win7-dark", "winxp", "win98", "macos", "macos-dark", "material", "material-dark",
];

export const THEME_STORAGE_KEY = "budget-track-theme";
export const DEFAULT_THEME: ThemeId = "dark";

export const getStoredTheme = (): ThemeId => {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (THEMES.some((th) => th.id === value)) return value as ThemeId;
  } catch {
    // storage unavailable
  }
  return DEFAULT_THEME;
};

const systemPrefersDark = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;

/** Resolves "system" to light or dark. */
export const resolveTheme = (id: ThemeId): ThemeDef => {
  const real = id === "system" ? (systemPrefersDark() ? "dark" : "light") : id;
  return THEME_DEFS.find((d) => d.id === real) ?? THEME_DEFS[2];
};

/** Inline style that applies a theme's variables to an element (used for previews). */
export const themeStyle = (id: ThemeId): React.CSSProperties => {
  const def = resolveTheme(id);
  const style: Record<string, string> = {
    background: `hsl(${def.vars.background})`,
    color: `hsl(${def.vars.foreground})`,
    colorScheme: def.dark ? "dark" : "light",
  };
  for (const [k, v] of Object.entries(def.vars)) style[`--${k}`] = v;
  Object.assign(style, chartVars(def));
  return style as React.CSSProperties;
};

/** Series colours for charts, spun around the accent hue so they stay on-theme. */
export const chartVars = (def: ThemeDef): Record<string, string> => {
  const [h, s, l] = def.primary;
  const sat = Math.max(55, Math.min(s, 85));
  const lum = def.dark ? Math.max(l, 58) : Math.min(l, 45);
  return {
    "--chart-1": `${h} ${sat}% ${lum}%`,
    "--chart-2": `${(h + 150) % 360} ${sat}% ${lum}%`,
    "--chart-3": `${(h + 40) % 360} ${Math.max(sat, 70)}% ${def.dark ? 62 : 46}%`,
    "--chart-4": `${(h + 210) % 360} ${sat}% ${lum}%`,
    "--chart-5": `${(h + 100) % 360} ${sat}% ${def.dark ? 60 : 42}%`,
    "--chart-6": `${(h + 290) % 360} ${sat}% ${lum}%`,
  };
};

export const applyTheme = (theme: ThemeId) => {
  const root = document.documentElement;
  const def = resolveTheme(theme);
  root.dataset.theme = def.id;
  root.dataset.mode = def.dark ? "dark" : "light";
  root.dataset.themeChoice = theme;
  root.classList.toggle("dark", def.dark);
  for (const [k, v] of Object.entries({ ...def.vars, ...chartVars(def) })) {
    root.style.setProperty(k.startsWith("--") ? k : `--${k}`, v);
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
};
