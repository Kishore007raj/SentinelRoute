import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Info,
  Wrench,
  ShieldAlert
} from "lucide-react"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary border border-primary/20",
        success:
          "bg-[var(--sr-emerald)]/10 text-[var(--sr-emerald)] border border-[var(--sr-emerald)]/20",
        warning:
          "bg-[var(--sr-amber)]/10 text-[var(--sr-amber)] border border-[var(--sr-amber)]/20",
        critical:
          "bg-[var(--sr-danger)]/10 text-[var(--sr-danger)] border border-[var(--sr-danger)]/20",
        info:
          "bg-[var(--sr-steel)]/10 text-[var(--sr-steel)] border border-[var(--sr-steel)]/20",
        inactive:
          "bg-muted/50 text-muted-foreground border border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  status: string
  showIcon?: boolean
}

export function StatusBadge({
  className,
  variant,
  status,
  showIcon = true,
  ...props
}: StatusBadgeProps) {
  
  // Auto-map variant if not explicitly provided
  let activeVariant = variant
  if (!activeVariant) {
    const s = status.toLowerCase()
    if (s.includes('active') || s.includes('completed') || s.includes('delivered') || s.includes('available')) activeVariant = 'success'
    else if (s.includes('delayed') || s.includes('warning') || s.includes('maintenance')) activeVariant = 'warning'
    else if (s.includes('critical') || s.includes('cancelled') || s === 'at-risk' || s.includes('at risk')) activeVariant = 'critical'
    else if (s.includes('pending') || s.includes('scheduled')) activeVariant = 'info'
    else activeVariant = 'inactive'
  }

  const iconComponent = showIcon ? getStatusIcon(activeVariant) : null

  return (
    <div className={cn(badgeVariants({ variant: activeVariant }), className)} {...props}>
      {iconComponent && React.createElement(iconComponent, { className: "w-3 h-3" })}
      {status}
    </div>
  )
}

function getStatusIcon(variant: string | null | undefined) {
  switch (variant) {
    case 'success': return CheckCircle2
    case 'warning': return AlertTriangle
    case 'critical': return ShieldAlert
    case 'info': return Clock
    case 'inactive': return Info
    default: return Info
  }
}
