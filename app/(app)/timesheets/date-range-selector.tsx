"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CalendarDays } from "lucide-react"

interface Props {
  userId: string
  from: string
  to: string
  basePath?: string
}

function monthStart(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset, 1)
  return d.toISOString().split("T")[0]
}

function monthEnd(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset + 1, 0)
  return d.toISOString().split("T")[0]
}

const PRESETS = [
  { label: "This Month",    from: () => monthStart(0),  to: () => monthEnd(0) },
  { label: "Last Month",    from: () => monthStart(-1), to: () => monthEnd(-1) },
  { label: "Last 3 Months", from: () => monthStart(-2), to: () => monthEnd(0) },
  { label: "Last 6 Months", from: () => monthStart(-5), to: () => monthEnd(0) },
]

export function DateRangeSelector({ userId, from, to, basePath = "/timesheets" }: Props) {
  const router = useRouter()
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  function navigate(f: string, t: string) {
    const params = new URLSearchParams()
    if (userId && basePath === "/timesheets") params.set("user", userId)
    params.set("from", f)
    params.set("to", t)
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => {
          const pFrom = p.from()
          const pTo = p.to()
          const active = from === pFrom && to === pTo
          return (
            <Button
              key={p.label}
              size="sm"
              variant={active ? "default" : "outline"}
              className="rounded-xl h-8 text-xs"
              onClick={() => navigate(pFrom, pTo)}
            >
              {p.label}
            </Button>
          )
        })}
      </div>

      {/* Custom range */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          type="date"
          value={customFrom}
          onChange={e => setCustomFrom(e.target.value)}
          className="h-8 w-36 rounded-xl text-sm"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <Input
          type="date"
          value={customTo}
          onChange={e => setCustomTo(e.target.value)}
          className="h-8 w-36 rounded-xl text-sm"
        />
        <Button
          size="sm"
          className="rounded-xl h-8 text-xs"
          onClick={() => navigate(customFrom, customTo)}
          disabled={!customFrom || !customTo || customFrom > customTo}
        >
          Apply
        </Button>
      </div>
    </div>
  )
}
