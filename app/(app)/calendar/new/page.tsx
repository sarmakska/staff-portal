"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, CalendarDays } from "lucide-react"
import { toast } from "sonner"
import { createCalendarEvent } from "@/lib/actions/calendar"
import Link from "next/link"

export default function NewCalendarEventPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isCompanyWide, setIsCompanyWide] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("is_company_wide", isCompanyWide ? "true" : "false")
    startTransition(async () => {
      const result = await createCalendarEvent(formData)
      if (result.success) {
        toast.success("Event added to calendar")
        router.push("/calendar")
      } else {
        toast.error(result.error ?? "Failed to create event")
      }
    })
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" asChild>
          <Link href="/calendar"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Calendar Event</h1>
          <p className="text-sm text-muted-foreground">Create a new event for the shared calendar</p>
        </div>
      </div>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />Event Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Event Title *</Label>
              <Input name="title" required placeholder="e.g. Team Lunch, Bank Holiday, Training Day" className="rounded-xl h-10" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input name="description" placeholder="Optional details" className="rounded-xl h-10" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date *</Label>
                <Input name="event_date" type="date" required className="rounded-xl h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input name="event_end_date" type="date" className="rounded-xl h-10" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Event Type *</Label>
              <Select name="event_type" defaultValue="team">
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="holiday">Bank Holiday</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="early_leave">Early Leave</SelectItem>
                  <SelectItem value="visitor">Visitor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
              <Checkbox
                id="company_wide"
                checked={isCompanyWide}
                onCheckedChange={(v) => setIsCompanyWide(v === true)}
              />
              <div>
                <label htmlFor="company_wide" className="text-sm font-medium text-foreground cursor-pointer">
                  Company-wide event
                </label>
                <p className="text-xs text-muted-foreground">Visible to all staff on the calendar</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 rounded-xl" disabled={isPending}>
                {isPending ? "Adding…" : "Add to Calendar"}
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" asChild>
                <Link href="/calendar">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
