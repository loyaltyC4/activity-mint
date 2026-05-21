import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "./card"
import { Badge } from "./badge"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./tooltip"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

const colorVariants = {
  indigo: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  purple: "bg-purple-500/10 text-purple-600 border-purple-200",
  rose: "bg-rose-500/10 text-rose-600 border-rose-200",
  amber: "bg-amber-500/10 text-amber-600 border-amber-200",
  teal: "bg-teal-500/10 text-teal-600 border-teal-200",
  blue: "bg-blue-500/10 text-blue-600 border-blue-200",
  violet: "bg-violet-500/10 text-violet-600 border-violet-200",
}

const StatCard = React.forwardRef(({
  icon,
  label,
  value,
  sub,
  trend,
  trendLabel,
  color = "indigo",
  tooltip,
  className,
  ...props
}, ref) => {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend > 0 ? "text-emerald-600" : trend < 0 ? "text-rose-500" : "text-slate-400"

  const content = (
    <Card ref={ref} className={cn("group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-default", className)} {...props}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border transition-colors", colorVariants[color])}>
                {icon}
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                {label}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            <div className="flex items-center gap-2 mt-2 min-h-[20px]">
              {trend !== undefined && (
                <Badge variant="secondary" className={cn("gap-1 font-semibold", trendColor)}>
                  <TrendIcon className="w-3 h-3" />
                  {Math.abs(trend)}%
                </Badge>
              )}
              {sub && (
                <span className="text-xs text-muted-foreground truncate">
                  {sub}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
})
StatCard.displayName = "StatCard"

export { StatCard }
