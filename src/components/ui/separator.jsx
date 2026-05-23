import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Simple visual separator (horizontal or vertical).
 * No Radix dep — semantic <hr> for horizontal, role="none" div for vertical.
 */
const Separator = React.forwardRef(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = "Separator"

export { Separator }
