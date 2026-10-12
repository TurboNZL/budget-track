import { useRef, useState } from "react";
import { ImageIcon, ImageOff, Upload } from "lucide-react";
import { themeWallpaper } from "turbothemes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { picker, useAppearance } from "@/lib/themes";
import { showError } from "@/utils/toast";
import Segmented from "./Segmented";
import { cardCls } from "./styles";

export default function WallpaperCard() {
  const { appearance } = useAppearance();
  const [hasCustom, setHasCustom] = useState(() => picker.wallpaper.hasCustom());
  const file = useRef<HTMLInputElement>(null);

  const enabled = appearance.wallpaper === true;
  const darkness = appearance.wallpaperDarkness ?? 0.3;
  const useCustom = appearance.wallpaperCustom === true && hasCustom;
  const custom = useCustom ? picker.wallpaper.getCustom() : null;

  const upload = async (f: File | undefined) => {
    if (!f) return;
    try {
      await picker.wallpaper.setCustom(f);
      setHasCustom(true);
      picker.set({ wallpaperCustom: true, wallpaper: true });
    } catch (e) {
      showError(e instanceof Error ? e.message : "Could not load that image");
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  return (
    <Card className={cardCls}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" />Wallpaper</CardTitle>
        <CardDescription>Off by default. Each colour theme has its own wallpaper, or load your own picture. Cards turn slightly see-through so it shows around them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={enabled} onCheckedChange={(v) => picker.set({ wallpaper: v })} aria-label="Show wallpaper" />
          Show wallpaper
        </label>
        <div className={enabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"} aria-disabled={!enabled}>
          <div className="relative h-32 rounded-lg overflow-hidden border border-border" style={{ background: custom ? `center / cover no-repeat url("${custom}")` : themeWallpaper(appearance.theme) }}>
            <div className="absolute inset-0 bg-black" style={{ opacity: darkness }} />
            <span className="absolute left-2 bottom-2 text-xs text-white/90 bg-black/40 rounded px-1.5 py-0.5">{custom ? "Your picture" : "Theme wallpaper"}</span>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Darkness</span><span className="text-muted-foreground tabular-nums">{Math.round(darkness * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={90} step={1} className="bt-range bt-hit w-full" aria-label="Wallpaper darkness"
              value={Math.round(darkness * 100)} style={{ "--p": `${(Math.round(darkness * 100) / 90) * 100}%` } as React.CSSProperties}
              onChange={(e) => picker.set({ wallpaperDarkness: Number(e.target.value) / 100 })}
            />
            <p className="text-xs text-muted-foreground mt-1">Raises the opacity of a black layer over the wallpaper.</p>
          </div>
          <Segmented label="Wallpaper source" value={useCustom ? "custom" : "theme"} onChange={(v) => picker.set({ wallpaperCustom: v === "custom" })}
            options={[{ value: "theme", label: "Theme wallpaper", icon: ImageIcon }, { value: "custom", label: "My picture", icon: Upload }]} />
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Button type="button" variant="outline" onClick={() => file.current?.click()}><Upload /> {hasCustom ? "Choose another picture" : "Load a picture"}</Button>
            {hasCustom && (
              <Button type="button" variant="outline" onClick={() => { picker.wallpaper.clearCustom(); setHasCustom(false); picker.set({ wallpaperCustom: false }); }}><ImageOff /> Remove my picture</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
