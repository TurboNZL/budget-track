import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { primaryBtnCls } from "./styles";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  submitLabel: string;
  submitIcon?: LucideIcon;
  onSubmit: () => void | Promise<void>;
  /** Optional second submit that keeps the window open, e.g. "Save & add another". */
  secondary?: { label: string; onClick: () => void | Promise<void> };
  wide?: boolean;
  /** Extra content on the left of the footer (e.g. a delete button). */
  footerStart?: React.ReactNode;
};

/**
 * The one window every data-entry form opens in. Short forms in a modal keep the page behind in
 * view, Enter submits, Esc cancels, and the primary action sits bottom-right (the usual order for
 * dialogs on desktop and the Material / Fluent / Adwaita guidelines).
 */
export default function EntryDialog({
  open, onOpenChange, title, description, icon: Icon, children, submitLabel, submitIcon: SubmitIcon,
  onSubmit, secondary, wide, footerStart,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeButton={false}
        className={cn(
          "max-h-[92dvh] overflow-y-auto gap-0 w-[calc(100vw-1.5rem)]",
          wide ? "max-w-2xl" : "max-w-lg"
        )}
        onOpenAutoFocus={(e) => {
          // Focus the first field rather than the close button
          const first = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), textarea");
          if (first) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <DialogHeader className="bt-titlebar !flex-row items-center space-y-0 text-left">
            <DialogTitle className="flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-primary shrink-0" />}
              {title}
            </DialogTitle>
            {!description && <DialogDescription className="sr-only">{title}</DialogDescription>}
            <DialogClose className="bt-close" aria-label="Close"><X className="h-4 w-4" /></DialogClose>
          </DialogHeader>
          {/* The window's content area. Styles with a framed window (Aero, Luna, Windows 98) draw it as a panel. */}
          <div className="bt-body px-5">
            {description && <DialogDescription className="pt-3">{description}</DialogDescription>}
            <div className="space-y-4 py-4">{children}</div>
          </div>
          <div className="bt-footer px-5 py-3">
            <DialogFooter className="gap-2 sm:gap-2 sm:items-center">
              {footerStart && <div className="sm:mr-auto">{footerStart}</div>}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {secondary && (
                <Button type="button" variant="outline" onClick={() => void secondary.onClick()}>
                  {secondary.label}
                </Button>
              )}
              <Button type="submit" className={primaryBtnCls}>
                {SubmitIcon && <SubmitIcon className="w-4 h-4" />}
                {submitLabel}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
