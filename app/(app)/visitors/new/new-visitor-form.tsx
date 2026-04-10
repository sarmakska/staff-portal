"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, ArrowRight, CheckCircle, Copy, QrCode } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { bookVisitor } from "@/lib/actions/visitors"

const STEPS = ["Visitor Details", "Review & Confirm"]

const TIME_WINDOWS = [
  "08:00 - 09:00", "09:00 - 10:00", "10:00 - 12:00",
  "12:00 - 14:00", "14:00 - 16:00", "16:00 - 18:00",
]

function parseTimeWindow(tw: string): { start: string; end: string } {
  const [s, e] = tw.split(" - ")
  return { start: `${s}:00`, end: `${e}:00` }
}

export default function NewVisitorForm() {
  const [step, setStep] = useState(0)
  const [referenceCode, setReferenceCode] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    visitorName: "", visitorEmail: "", company: "", purpose: "", date: "",
    timeWindow: "09:00 - 10:00", guestCount: "1",
    requiresId: false, accessibilityNotes: "", sendEmail: true,
  })

  const update = (key: string, value: string | boolean) => setForm({ ...form, [key]: value })
  const canProceed = form.visitorName && form.visitorEmail && form.purpose && form.date

  const handleConfirm = () => {
    startTransition(async () => {
      const { start, end } = parseTimeWindow(form.timeWindow)
      const result = await bookVisitor({
        visitorName: form.visitorName,
        visitorEmail: form.visitorEmail,
        company: form.company,
        purpose: form.purpose,
        visitDate: form.date,
        timeWindowStart: start,
        timeWindowEnd: end,
        guestCount: parseInt(form.guestCount) || 1,
        requiresId: form.requiresId,
        accessibilityNotes: form.accessibilityNotes,
        sendConfirmationEmail: form.sendEmail,
      })
      if (result.success && result.referenceCode) {
        setReferenceCode(result.referenceCode)
      } else {
        toast.error(result.error ?? "Failed to book visitor")
      }
    })
  }

  if (referenceCode) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="rounded-2xl border-border shadow-sm max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mx-auto">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Booking Confirmed</h2>
              <p className="text-sm text-muted-foreground mt-1">Visitor pre-registered successfully.</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              {[["Visitor", form.visitorName], ["Date", form.date]].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reference</span>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-foreground font-mono">{referenceCode}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => { navigator.clipboard.writeText(referenceCode); toast.success("Copied!") }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6">
              <QrCode className="h-16 w-16 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Show reference code at reception: {referenceCode}</p>
            </div>
            <Button className="w-full rounded-xl" asChild>
              <Link href="/visitors">Back to Bookings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/visitors"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Book a Visitor</h1>
          <p className="text-sm text-muted-foreground">Pre-register a guest for your office</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden text-sm font-medium sm:inline ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`mx-1 h-px w-8 sm:w-12 ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <Card className="rounded-2xl border-border shadow-sm max-w-2xl">
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Visitor Name *</Label>
                  <Input value={form.visitorName} onChange={(e) => update("visitorName", e.target.value)} placeholder="John Smith" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.visitorEmail} onChange={(e) => update("visitorEmail", e.target.value)} placeholder="john@company.com" className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Acme Corp" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Purpose *</Label>
                  <Input value={form.purpose} onChange={(e) => update("purpose", e.target.value)} placeholder="Project Meeting" className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Time Window</Label>
                  <Select value={form.timeWindow} onValueChange={(v) => update("timeWindow", v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIME_WINDOWS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Number of Guests</Label>
                  <Input type="number" min="1" value={form.guestCount} onChange={(e) => update("guestCount", e.target.value)} className="rounded-xl" />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <Switch checked={form.requiresId} onCheckedChange={(v) => update("requiresId", v)} id="req-id" />
                  <Label htmlFor="req-id" className="cursor-pointer">Requires photo ID</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accessibility Notes</Label>
                <Textarea value={form.accessibilityNotes} onChange={(e) => update("accessibilityNotes", e.target.value)} placeholder="e.g. wheelchair access needed" className="rounded-xl" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Send confirmation email to visitor</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Visitor receives their reference code · Reception is CC'd</p>
                </div>
                <Switch checked={form.sendEmail} onCheckedChange={(v) => update("sendEmail", v)} id="send-email" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">Review the booking details before confirming.</p>
              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                {[
                  ["Visitor", form.visitorName],
                  ["Email", form.visitorEmail],
                  ["Company", form.company || "—"],
                  ["Purpose", form.purpose],
                  ["Date", form.date],
                  ["Time", form.timeWindow],
                  ["Guests", form.guestCount],
                  ["ID Required", form.requiresId ? "Yes" : "No"],
                  ["Send Email", form.sendEmail ? "Yes — visitor + reception CC'd" : "No"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{String(label)}</span>
                    <span className="font-medium text-foreground">{String(value)}</span>
                  </div>
                ))}
                {form.accessibilityNotes && (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-1">Accessibility Notes</p>
                    <p className="text-sm text-foreground">{form.accessibilityNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => setStep(0)} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" />Back
            </Button>
            {step === 0 ? (
              <Button className="rounded-xl gap-2" onClick={() => setStep(1)} disabled={!canProceed}>
                Review<ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="rounded-xl gap-2" onClick={handleConfirm} disabled={isPending}>
                <CheckCircle className="h-4 w-4" />{isPending ? "Booking…" : "Confirm Booking"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
