import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ConfirmDialog({
  open, title, description, confirmLabel = "Delete", onConfirm, onCancel,
}: { open: boolean; title: string; description?: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; onCancel: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader className="bt-titlebar !flex-row items-center space-y-0 text-left">
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        {description && (
          <div className="bt-body px-5 py-4">
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </div>
        )}
        <div className="bt-footer px-5 py-3">
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirm()}>{confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
