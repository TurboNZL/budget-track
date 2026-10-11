import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Icon-only action with a tooltip (title) and an accessible name. */
export default function IconButton({
  icon: Icon, label, onClick, tone = "default", className, disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  tone?: "default" | "danger";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn("h-8 w-8 text-muted-foreground", tone === "danger" ? "hover:text-negative" : "hover:text-primary", className)}
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}
