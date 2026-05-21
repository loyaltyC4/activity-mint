import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "./badge"

const SectionHeader = React.forwardRef(({
  icon,
  title,
  badge,
  badgeVariant = "default",
  description,
  children,
  className,
  ...props
}, ref) => (
  <div ref={ref} className={cn("flex items-center justify-between mb-5", className)} {...props}>
    <div className="flex items-center gap-3">
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          {React.cloneElement(icon, { className: "w-4 h-4 text-primary" })}
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-foreground text-base sm:text-lg tracking-tight">{title}</h3>
          {badge && (
            <Badge variant={badgeVariant} className="text-[10px] font-bold uppercase tracking-wider">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
    {children && <div className="flex items-center gap-2">{children}</div>}
  </div>
))
SectionHeader.displayName = "SectionHeader"

export { SectionHeader }
