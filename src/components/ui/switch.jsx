import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Controlled toggle switch.
 * No Radix dep — semantic role="switch" button.
 * Matches the toggle pattern from the spark-insights design:
 *  42px wide, 24px tall, 18px thumb that slides between left/right.
 */
const Switch = React.forwardRef(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-[42px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-sm ring-0 transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0"
        )}
      />
    </button>
  )
)
Switch.displayName = "Switch"

export { Switch }
