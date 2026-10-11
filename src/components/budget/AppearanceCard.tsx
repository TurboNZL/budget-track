import { useState } from "react";
import { Check, Eye, Palette, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setTheme, setUiStyle, useAppearance } from "@/lib/appearance";
import { PLATFORM_THEME_IDS, THEMES, themeStyle, type ThemeId } from "@/lib/theme";
import { UI_STYLES, type UiStyleId } from "@/lib/uiStyle";
import { cn } from "@/lib/utils";
import PreviewDashboard from "./PreviewDashboard";
import { cardCls } from "./styles";

export default function AppearanceCard() {
  const { theme, ui, def } = useAppearance();
  // Hovering or focusing an option previews it, combined with the other current choice
  const [hoverTheme, setHoverTheme] = useState<ThemeId | null>(null);
  const [hoverUi, setHoverUi] = useState<UiStyleId | null>(null);
  const shownTheme = hoverTheme ?? theme;
  const shownUi = hoverUi ?? ui;
  const label = `${THEMES.find((t) => t.id === shownTheme)?.label} + ${UI_STYLES.find((s) => s.id === shownUi)?.label}`;

  // The platform's own palette for a UI style, in the light or dark variant matching the current theme
  const matchingFor = (style: UiStyleId): ThemeId | null => {
    const m = UI_STYLES.find((s) => s.id === style)?.matching;
    return m ? (def.dark ? m.dark ?? m.light : m.light) : null;
  };
  const matching = matchingFor(ui);

  const themeButton = (t: (typeof THEMES)[number]) => {
    const selected = theme === t.id;
    return (
      <button
        key={t.id} type="button" role="radio" aria-checked={selected}
        onClick={() => setTheme(t.id)}
        onMouseEnter={() => setHoverTheme(t.id)} onFocus={() => setHoverTheme(t.id)} onBlur={() => setHoverTheme(null)}
        className={cn("text-left rounded-lg border p-2 transition-colors hover:border-primary", selected ? "border-primary ring-1 ring-primary" : "border-border")}
      >
        <span className="block h-10 rounded-md border border-border/60 overflow-hidden relative" style={themeStyle(t.id)} aria-hidden>
          <span className="absolute left-1.5 top-1.5 h-2 w-8 rounded-sm" style={{ background: "hsl(var(--primary))" }} />
          <span className="absolute left-1.5 bottom-1.5 right-1.5 h-3 rounded-sm" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: "hsl(var(--chart-2))" }} />
        </span>
        <span className="mt-1.5 flex items-center justify-between gap-1 text-xs font-medium">
          <span className="truncate">{t.label}</span>
          {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
        </span>
      </button>
    );
  };

  const themeGrid = "grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2";

  return (
    <Card className={cardCls}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" />Appearance</CardTitle>
        <CardDescription>
          Pick a colour theme and a UI style; any combination works. The framed preview shows the combination before (and as) you choose. Saved in this browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_27rem] items-start">
        {/* The preview sits in its own framed column so it can't be mistaken for the real page */}
        <div className="lg:order-2 lg:sticky lg:top-24">
          <div className="rounded-xl border-4 border-dashed border-primary bg-primary/10 p-3 shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 font-bold uppercase tracking-wider text-primary-foreground"><Eye className="w-3.5 h-3.5" />Preview</span>
              <span className="truncate font-medium text-foreground">{label}</span>
            </div>
            <PreviewDashboard theme={shownTheme} ui={shownUi} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Not your real page. Hover or focus an option to try it, click to apply.</p>
          </div>
        </div>

        <div className="space-y-5 min-w-0 lg:order-1">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Colour theme</h4>
            <div role="radiogroup" aria-label="Colour theme" className={themeGrid} onMouseLeave={() => setHoverTheme(null)}>
              {THEMES.filter((t) => !PLATFORM_THEME_IDS.includes(t.id)).map(themeButton)}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Platform colours</h4>
            <p className="text-xs text-muted-foreground">Palettes copied from a desktop or OS, made to pair with the matching UI style.</p>
            <div role="radiogroup" aria-label="Platform colour theme" className={themeGrid} onMouseLeave={() => setHoverTheme(null)}>
              {THEMES.filter((t) => PLATFORM_THEME_IDS.includes(t.id)).map(themeButton)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium">UI style</h4>
              {matching && matching !== theme && (
                <Button type="button" size="sm" variant="outline" onClick={() => setTheme(matching)}
                  onMouseEnter={() => setHoverTheme(matching)} onMouseLeave={() => setHoverTheme(null)}>
                  <Wand2 /> Use matching colours ({THEMES.find((t) => t.id === matching)?.label})
                </Button>
              )}
            </div>
            <div role="radiogroup" aria-label="UI style" className="grid grid-cols-1 sm:grid-cols-2 gap-2" onMouseLeave={() => setHoverUi(null)}>
              {UI_STYLES.map((s) => {
                const selected = ui === s.id;
                return (
                  <button
                    key={s.id} type="button" role="radio" aria-checked={selected} data-ui-option
                    onClick={() => setUiStyle(s.id)}
                    onMouseEnter={() => setHoverUi(s.id)} onFocus={() => setHoverUi(s.id)} onBlur={() => setHoverUi(null)}
                    className={cn("text-left p-3 rounded-lg border bg-muted transition-colors hover:bg-accent", selected ? "border-primary ring-1 ring-primary" : "border-border")}
                  >
                    {/* Each option is set in its own font */}
                    <span data-ui={s.id} className="block bg-transparent">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{s.label}</span>
                        {selected && <Check className="w-4 h-4 text-primary" />}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-1">{s.description}</span>
                      <span className="block text-xs mt-1.5 opacity-80">Aa Bb 0123 · {s.font}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
