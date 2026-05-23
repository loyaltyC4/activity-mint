import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Scroll container with thin custom-styled scrollbar.
 * No Radix dep — native CSS overflow + scrollbar utilities from Tailwind.
 * Used in the Sidebar for nav overflow.
 */
const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative overflow-y-auto overflow-x-hidden",
      "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
      "[&::-webkit-scrollbar]:w-1.5",
      "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60",
      "[&::-webkit-scrollbar-track]:bg-transparent",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
