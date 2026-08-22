import * as React from "react"
import { cn } from "@/lib/utils"
import { motion, HTMLMotionProps } from "framer-motion"

interface DashboardCardProps extends Omit<HTMLMotionProps<"div">, "title" | "children"> {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ElementType
  action?: React.ReactNode
  children?: React.ReactNode
  noPadding?: boolean
  delay?: number
}

export function DashboardCard({
  className,
  title,
  subtitle,
  icon: Icon,
  action,
  noPadding = false,
  delay = 0,
  children,
  ...props
}: DashboardCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "flex flex-col bg-card border border-border rounded-lg shadow-sm",
        className
      )}
      {...props}
    >
      {(title || subtitle || Icon || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/5 rounded-t-lg">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
            )}
            <div>
              {title && <h3 className="text-sm font-semibold text-foreground tracking-wide">{title}</h3>}
              {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={cn("flex-1", !noPadding && "p-6")}>
        {children}
      </div>
    </motion.div>
  )
}
