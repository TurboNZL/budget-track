// The look of fields, cards and buttons belongs to the UI style (turbothemes): the primitives in components/ui carry the hook
// classes (.input .card .btn), so nothing here may set colours, borders or radii or it would beat the style. Kept so call sites
// can still say what they mean.
export const inputCls = "";
export const triggerCls = "";
export const primaryBtnCls = "";
export const cardCls = "";
export const labelCls = "block text-sm font-medium mb-1 text-foreground/80";
export const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const addDaysStr = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const readStored = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
};
export { readStored, writeStored };
