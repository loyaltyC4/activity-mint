import { cn } from "@/lib/utils"

/**
 * Skeleton with a "shimmer" sweep — a thin diagonal light bar moves
 * left-to-right across the muted background, giving warm-loading feel.
 * Backwards-compatible with the original animate-pulse variant: passing
 * `variant="pulse"` keeps the legacy behaviour.
 */
function Skeleton({ className, variant = "shimmer", ...props }) {
  if (variant === "pulse") {
    return (
      <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
    )
  }
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0",
        "before:-translate-x-full",
        "before:animate-[shimmer_1.6s_ease-in-out_infinite]",
        "before:bg-gradient-to-r",
        "before:from-transparent before:via-white/70 before:to-transparent",
        "dark:before:via-white/10",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
