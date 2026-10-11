import { useMemo } from "react";
import { brandDataUri } from "@/lib/brand";
import { useAppearance } from "@/lib/appearance";
import { cn } from "@/lib/utils";

/** The logo. Drawn from the same SVG as the favicon, in the selected colour theme and UI style. */
export default function BrandMark({ className }: { className?: string }) {
  const { theme, ui } = useAppearance();
  const src = useMemo(() => brandDataUri(theme, ui), [theme, ui]);
  return <img src={src} alt="" width={32} height={32} className={cn("w-8 h-8 shrink-0", className)} />;
}
