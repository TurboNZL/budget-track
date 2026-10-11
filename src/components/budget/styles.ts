export const inputCls = "bg-muted border-border text-foreground rounded-lg px-3 py-2 w-full";
export const triggerCls = "bg-muted border-border text-foreground rounded-lg px-3 py-2 w-full";
export const labelCls = "block text-sm font-medium mb-1 text-foreground/80";
export const primaryBtnCls = "bg-primary hover:bg-primary/90 text-primary-foreground border-0";
export const cardCls = "bg-card border-border";
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
