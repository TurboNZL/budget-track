import * as React from "react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.ComponentProps<"input">, "type" | "checked" | "onChange"> & {
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
};

/** A native checkbox: turbothemes draws `input[type=checkbox]` for every UI style, so there is nothing to style here. */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, checked, onCheckedChange, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    checked={checked === true}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
