/**
 * UI styles change shape, typography, motion, borders and depth. They never set colours, so any of
 * them can be combined with any colour theme (see theme.ts).
 */
import type { ThemeId } from "./theme";

export type UiStyleId = "default" | "gtk4" | "breeze" | "win11" | "win10" | "win7" | "winxp" | "win98" | "macos" | "material";

export type UiStyleDef = {
  id: UiStyleId;
  label: string;
  description: string;
  /** CSS font stack (also set in ui-styles.css). */
  font: string;
  /** Corner radius used by the brand mark / charts, in px. */
  radius: number;
  /** Colour themes that copy this platform's palette: [light, dark]. Win 7 / XP / 98 have a light one only. */
  matching?: { light: ThemeId; dark?: ThemeId };
};

export const UI_STYLES: UiStyleDef[] = [
  { id: "default", label: "Default", description: "The standard BudgetTrack look in Inter.", font: "Inter Variable", radius: 8, matching: { light: "light", dark: "dark" } },
  { id: "gtk4", label: "GTK 4 (Adwaita)", description: "Large rounded corners, soft flat surfaces, pill tabs and springy motion in Cantarell.", font: "Cantarell", radius: 12, matching: { light: "adwaita", dark: "adwaita-dark" } },
  { id: "breeze", label: "KDE Breeze", description: "Compact and tidy with thin outlines, glow-on-hover and short fades in Noto Sans.", font: "Noto Sans", radius: 3, matching: { light: "breeze", dark: "breeze-dark" } },
  { id: "win11", label: "Windows 11", description: "Fluent: rounded, light shadows, accent underline on tabs and smooth slide-in motion in Segoe UI Variable.", font: "Segoe UI Variable", radius: 8, matching: { light: "win11", dark: "win11-dark" } },
  { id: "win10", label: "Windows 10", description: "Flat and square with crisp borders and quick slide transitions in Segoe UI.", font: "Segoe UI", radius: 0, matching: { light: "win10", dark: "win10-dark" } },
  { id: "win7", label: "Windows 7", description: "Aero: glass title bars, grey gel buttons with a blue glow, rounded windows and fading highlights in Segoe UI.", font: "Segoe UI", radius: 5, matching: { light: "win7", dark: "win7-dark" } },
  { id: "winxp", label: "Windows XP", description: "Luna: bevelled buttons, blue title bars, instant menus and Tahoma.", font: "Tahoma", radius: 4, matching: { light: "winxp" } },
  { id: "win98", label: "Windows 98", description: "Classic: grey bevelled 3D controls, navy title bars, no animation and MS Sans Serif style type.", font: "Tahoma", radius: 0, matching: { light: "win98" } },
  { id: "macos", label: "macOS", description: "Soft rounded controls, translucent sidebars feel, blue accent focus rings and gentle spring motion in the system sans.", font: "system-ui", radius: 10, matching: { light: "macos", dark: "macos-dark" } },
  { id: "material", label: "Material 3", description: "Pill buttons, tonal surfaces, filled text fields with an underline and a ripple-like press in Roboto.", font: "Roboto", radius: 16, matching: { light: "material", dark: "material-dark" } },
];

export const UI_STYLE_STORAGE_KEY = "budget-track-ui-style";

export const getStoredUiStyle = (): UiStyleId => {
  try {
    const value = window.localStorage.getItem(UI_STYLE_STORAGE_KEY);
    if (UI_STYLES.some((s) => s.id === value)) return value as UiStyleId;
  } catch {
    // storage unavailable
  }
  return "default";
};

export const applyUiStyle = (style: UiStyleId) => {
  document.documentElement.dataset.ui = style;
  try {
    window.localStorage.setItem(UI_STYLE_STORAGE_KEY, style);
  } catch {
    // ignore
  }
};
