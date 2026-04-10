"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { UserPlus, ArrowRight, Trash2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { deleteVisitor } from "@/lib/actions/visitors"

interface Visitor {
  id: string
  visitor_name: string
  company: string | null
  visit_date: string
  time_window_start: string | null
  status: string
  host: { full_name: string } | null
}

interface Props {
  visitors: Visitor[]
  canDelete: boolean
}

export function VisitorsClient({ visitors: initial, canDelete }: Props) {
  const [visitors, setVisitors] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete visitor record for ${name}?`)) return
    startTransition(async () => {
      const res = await deleteVisitor(id)
      if (!res.success) { toast.error(res.error ?? "Delete failed"); return }
      setVisitors(prev => prev.filter(v => v.id !== id))
      toast.success("Visitor record deleted")
    })
  }

  if (visitors.length === 0) {
    return (
      <EmptyState
        icon={<UserPlus className="h-7 w-7 text-muted-foreground" />}
        title="No visitors booked"
        description="Book your first visitor using the button above."
        action={<Button asChild className="rounded-xl"><Link href="/visitors/new">Book Visitor</Link></Button>}
      />
    )
  }

  return (
    <div className="space-y-3">
      {visitors.map((v) => (
        <Card key={v.id} className="rounded-2xl border-border shadow-sm hover:shadow-md transition-shadow group">
          <CardContent className="flex items-center justify-between p-4">
            <Link href={`/visitors/${v.id}`} className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{v.visitor_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {v.company ? `${v.company} · ` : ""}
                  {new Date(v.visit_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {v.time_window_start ? ` · ${String(v.time_window_start).substring(0, 5)}` : ""}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={v.status} />
              {canDelete && (
                <button
                  onClick={() => handleDelete(v.id, v.visitor_name)}
                  disabled={isPending}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                  title="Delete visitor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <Link href={`/visitors/${v.id}`}>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
