import { useRef, useState } from "react";
import { ImageIcon, ImageOff, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { refreshWallpaper, useAppearance } from "@/lib/appearance";
import { clearCustomWallpaper, getCustomImage, getWallpaperSettings, saveCustomWallpaper, saveWallpaperSettings, themeWallpaper, type WallpaperSettings } from "@/lib/wallpaper";
import { showError } from "@/utils/toast";
import Segmented from "./Segmented";
import { cardCls } from "./styles";

export default function WallpaperCard() {
  const { theme } = useAppearance();
  const [wp, setWp] = useState<WallpaperSettings>(getWallpaperSettings);
  const [hasCustom, setHasCustom] = useState(() => getCustomImage() !== null);
  const file = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<WallpaperSettings>) => {
    const next = { ...wp, ...patch };
    setWp(next);
    saveWallpaperSettings(next);
    refreshWallpaper();
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    try {
      await saveCustomWallpaper(f);
      setHasCustom(true);
      update({ custom: true, enabled: true });
    } catch (e) {
      showError(e instanceof Error ? e.message : "Could not load that image");
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  const custom = wp.custom && hasCustom ? getCustomImage() : null;

  return (
    <Card className={cardCls}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" />Wallpaper</CardTitle>
        <CardDescription>Off by default. Each colour theme has its own wallpaper, or load your own picture. Cards turn slightly see-through so it shows around them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={wp.enabled} onCheckedChange={(v) => update({ enabled: v })} aria-label="Show wallpaper" />
          Show wallpaper
        </label>
        <div className={wp.enabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"} aria-disabled={!wp.enabled}>
          <div className="relative h-32 rounded-lg overflow-hidden border border-border" style={{ background: custom ? `center / cover no-repeat url("${custom}")` : themeWallpaper(theme) }}>
            <div className="absolute inset-0 bg-black" style={{ opacity: wp.darkness }} />
            <span className="absolute left-2 bottom-2 text-xs text-white/90 bg-black/40 rounded px-1.5 py-0.5">{custom ? "Your picture" : "Theme wallpaper"}</span>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Darkness</span><span className="text-muted-foreground tabular-nums">{Math.round(wp.darkness * 100)}%</span>
            </div>
            <Slider min={0} max={90} step={1} value={[Math.round(wp.darkness * 100)]} onValueChange={([v]) => update({ darkness: v / 100 })} aria-label="Wallpaper darkness" />
            <p className="text-xs text-muted-foreground mt-1">Raises the opacity of a black layer over the wallpaper.</p>
          </div>
          <Segmented label="Wallpaper source" value={wp.custom && hasCustom ? "custom" : "theme"} onChange={(v) => update({ custom: v === "custom" })}
            options={[{ value: "theme", label: "Theme wallpaper", icon: ImageIcon }, { value: "custom", label: "My picture", icon: Upload }]} />
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Button type="button" variant="outline" onClick={() => file.current?.click()}><Upload /> {hasCustom ? "Choose another picture" : "Load a picture"}</Button>
            {hasCustom && (
              <Button type="button" variant="outline" onClick={() => { clearCustomWallpaper(); setHasCustom(false); update({ custom: false }); }}><ImageOff /> Remove my picture</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
