import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ConfirmDialog({
  open, title, description, confirmLabel = "Delete", onConfirm, onCancel,
}: { open: boolean; title: string; description?: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; onCancel: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="bt-window">
        <AlertDialogHeader className="bt-titlebar text-left">
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="bt-body space-y-4">
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirm()}>{confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
