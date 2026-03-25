import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusStyles: Record<string, string> = {
  present: "bg-success/10 text-success border-success/20",
  absent: "bg-destructive/10 text-destructive border-destructive/20",
  late: "bg-warning/10 text-warning border-warning/20",
  "half-day": "bg-info/10 text-info border-info/20",
  holiday: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  weekend: "bg-muted text-muted-foreground border-border",
  pending: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  approved: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
  submitted: "bg-info/10 text-info border-info/20",
  applied: "bg-success/10 text-success border-success/20",
  "under-review": "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  resolved: "bg-success/10 text-success border-success/20",
  closed: "bg-muted text-muted-foreground border-border",
  investigating: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  booked: "bg-info/10 text-info border-info/20",
  "checked-in": "bg-success/10 text-success border-success/20",
  "checked-out": "bg-muted text-muted-foreground border-border",
  expired: "bg-destructive/10 text-destructive border-destructive/20",
  normal: "bg-success/10 text-success border-success/20",
  anomaly: "bg-warning/10 text-warning border-warning/20",
  missing: "bg-destructive/10 text-destructive border-destructive/20",
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground border-border",
  low: "bg-info/10 text-info border-info/20",
  medium: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  high: "bg-warning/10 text-warning border-warning/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  employee: "bg-brand-taupe/10 text-brand-taupe border-brand-taupe/20",
  manager: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  admin: "bg-brand-magenta/10 text-brand-magenta border-brand-magenta/20",
  hr: "bg-info/10 text-info border-info/20",
  reception: "bg-success/10 text-success border-success/20",
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || "bg-muted text-muted-foreground border-border"
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", style, className)}>
      {status.replace(/-/g, " ")}
    </span>
  )
}
