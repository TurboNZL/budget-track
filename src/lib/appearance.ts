import { useSyncExternalStore } from "react";
import { applyFavicon } from "./brand";
import { applyTheme, getStoredTheme, resolveTheme, type ThemeId } from "./theme";
import { applyUiStyle, getStoredUiStyle, type UiStyleId } from "./uiStyle";
import { applyWallpaper } from "./wallpaper";

const EVENT = "bt-appearance";
const notify = () => window.dispatchEvent(new Event(EVENT));

export const setTheme = (id: ThemeId) => {
  applyTheme(id);
  notify();
};

export const setUiStyle = (id: UiStyleId) => {
  applyUiStyle(id);
  notify();
};

/** Re-applies the wallpaper after its settings changed. */
export const refreshWallpaper = () => {
  applyWallpaper(getStoredTheme());
  notify();
};

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const snapshot = () => `${getStoredTheme()}|${getStoredUiStyle()}`;

/** The selected theme / UI style; components re-render when either changes. */
export const useAppearance = () => {
  const [theme, ui] = useSyncExternalStore(subscribe, snapshot, snapshot).split("|") as [ThemeId, UiStyleId];
  return { theme, ui, def: resolveTheme(theme) };
};

/** Run once before the first render. */
export const initAppearance = () => {
  const sync = () => {
    const theme = getStoredTheme();
    const ui = getStoredUiStyle();
    applyFavicon(theme, ui);
    applyWallpaper(theme);
  };
  applyTheme(getStoredTheme());
  applyUiStyle(getStoredUiStyle());
  sync();
  window.addEventListener(EVENT, sync);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getStoredTheme() === "system") setTheme("system");
  });
};
