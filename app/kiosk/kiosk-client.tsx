"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PinKeypad } from "@/components/shared/pin-keypad"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  LogIn, LogOut, UserPlus, ArrowLeft, CheckCircle, AlertCircle,
  Users, BadgeCheck, Phone, RotateCcw
} from "lucide-react"
import { toast } from "sonner"
import {
  registerWalkInVisitor, checkoutVisitor, checkinVisitor, lookupVisitorByName,
  getStaffForKiosk, getActiveVisitorsForCheckout
} from "@/lib/actions/visitors"
import { authenticateKioskPin, submitKioskAttendance } from "@/lib/actions/kiosk"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Staff = { id: string; full_name: string; is_clocked_in: boolean; is_wfh: boolean; wfh_block?: string }
type KioskMode = "home" | "staff-pin" | "staff-done" | "walk-in-form" | "walk-in-done" | "visitor-checkout-list" | "checkout-done" | "visitor-ref-entry" | "visitor-ref-confirm"

interface Props {
  initialStaff: Staff[]
}

export default function KioskClient({ initialStaff }: Props) {
  const [mode, setMode] = useState<KioskMode>("home")
  const [mobileTab, setMobileTab] = useState<"staff" | "visitors">("staff")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isPending, startTransition] = useTransition()

  const [staffInfo, setStaffInfo] = useState<Staff | null>(null)
  const [countdown, setCountdown] = useState(5)

  // Staff data — pre-loaded from server, no loading flash
  const [hosts, setHosts] = useState<Staff[]>(initialStaff)
  const [activeVisitors, setActiveVisitors] = useState<{ id: string; visitor_name: string; company: string | null; host_name: string }[]>([])

  const [walkInForm, setWalkInForm] = useState({ name: "", phone: "", company: "", hostId: "", consent: false })
  const [visitorNameSearch, setVisitorNameSearch] = useState("")
  const [visitorMatches, setVisitorMatches] = useState<{ id: string; visitor_name: string; company: string | null; host_name: string }[]>([])
  const [visitorConfirmData, setVisitorConfirmData] = useState<{ id: string; visitor_name: string; company: string | null; host_name: string } | null>(null)

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-return countdown
  useEffect(() => {
    if (mode === "staff-done" || mode === "walk-in-done" || mode === "checkout-done") {
      setCountdown(5)
      const interval = setInterval(() => setCountdown(c => c - 1), 1000)
      const t = setTimeout(() => { clearInterval(interval); reset() }, 5000)
      return () => { clearTimeout(t); clearInterval(interval) }
    }
    if (mode === "visitor-checkout-list") {
      getActiveVisitorsForCheckout().then(setActiveVisitors)
    }
  }, [mode])

  const reset = useCallback(() => {
    setMode("home")
    setMobileTab("staff")
    setStaffInfo(null)
    setWalkInForm({ name: "", phone: "", company: "", hostId: "", consent: false })
    setVisitorNameSearch("")
    setVisitorMatches([])
    setVisitorConfirmData(null)
  }, [])

  const handleStaffSelect = (staff: Staff) => {
    setStaffInfo(staff)
    setMode("staff-pin")
  }

  const handlePinComplete = (pin: string) => {
    if (!staffInfo) return
    startTransition(async () => {
      const res = await authenticateKioskPin(pin)
      if (res.success && res.user && res.user.id === staffInfo.id) {
        // Block clock-in if WFH prevents it
        if (res.user.wfh_block && !res.user.is_clocked_in) {
          toast.error(res.user.wfh_block)
          setMode("home")
          return
        }
        // Use fresh DB value from authenticateKioskPin, not stale client state
        const action = res.user.is_clocked_in ? "out" : "in"
        const attRes = await submitKioskAttendance(staffInfo.id, action)
        if (attRes.success) {
          setMode("staff-done")
          getStaffForKiosk().then(data => setHosts(data))
        } else {
          toast.error(attRes.error || `Failed to clock ${action}`)
          setMode("home")
        }
      } else {
        toast.error(res.error || "Wrong PIN or user mismatch")
        setMode("home")
      }
    })
  }

  const handleWalkInSubmit = () => {
    if (!walkInForm.name || !walkInForm.phone || !walkInForm.hostId) {
      toast.error("Name, Phone, and Host are required.")
      return
    }
    startTransition(async () => {
      const res = await registerWalkInVisitor({
        visitor_name: walkInForm.name,
        visitor_phone: walkInForm.phone,
        company: walkInForm.company,
        host_user_id: walkInForm.hostId,
      })
      if (res.success) setMode("walk-in-done")
      else toast.error(res.error || "Registration failed")
    })
  }

  const handleCheckoutVisitor = (visitorId: string, visitorName: string) => {
    if (!confirm(`Sign out ${visitorName}?`)) return
    startTransition(async () => {
      const res = await checkoutVisitor(visitorId)
      if (res.success) setMode("checkout-done")
      else toast.error(res.error || "Checkout failed")
    })
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background font-sans overflow-hidden">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-8 sm:py-4 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Memo" className="h-8 sm:h-10 drop-shadow-sm" />
          <BadgeCheck className="h-5 w-5 text-brand-taupe opacity-70 hidden sm:block" />
        </div>
        <div className="text-right">
          <p className="text-2xl sm:text-4xl font-extrabold text-foreground tabular-nums tracking-tight leading-none">
            {currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
            {currentTime.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </p>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Soft background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-brand-taupe/8 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 -right-[10%] w-[50%] h-[50%] bg-blue-500/4 blur-[120px] rounded-full" />
        </div>

        {/* ── HOME MODE ─────────────────────────────────────── */}
        {mode === "home" && (
          <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 w-full p-3 sm:p-5 xl:p-6 z-10 overflow-hidden">

            {/* Mobile tab bar */}
            <div className="xl:hidden flex gap-2 shrink-0">
              <button
                onClick={() => setMobileTab("staff")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${mobileTab === "staff" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
              >
                <Users className="h-4 w-4" /> Team
              </button>
              <button
                onClick={() => setMobileTab("visitors")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${mobileTab === "visitors" ? "bg-brand-taupe text-white" : "bg-muted text-muted-foreground"}`}
              >
                <UserPlus className="h-4 w-4" /> Visitors
              </button>
            </div>

            {/* ── Staff Panel ────────────────────────────────── */}
            <div className={`flex-[2] flex flex-col min-h-0 ${mobileTab !== "staff" ? "hidden xl:flex" : "flex"}`}>
              <Card className="flex flex-col overflow-hidden rounded-2xl border-border bg-card shadow-sm h-full">
                <div className="px-5 py-4 border-b border-border shrink-0">
                  <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-brand-taupe" />
                    Team Attendance
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Tap your name to clock in or out.</p>
                </div>
                <CardContent className="p-3 sm:p-5 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-3">
                    {hosts.map(staff => (
                      <button
                        key={staff.id}
                        onClick={() => handleStaffSelect(staff)}
                        className={`flex flex-col items-center justify-center p-3 sm:p-5 rounded-xl border-2 transition-all active:scale-95 text-center gap-2 sm:gap-3 ${
                          staff.is_clocked_in
                            ? "bg-emerald-50 border-emerald-300 hover:border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-700"
                            : staff.is_wfh
                            ? "bg-blue-50 border-blue-300 hover:border-blue-500 dark:bg-blue-950/40 dark:border-blue-700"
                            : "bg-muted/50 border-border hover:border-brand-taupe/50"
                        }`}
                      >
                        <div className={`flex h-10 w-10 sm:h-13 sm:w-13 items-center justify-center rounded-full text-base sm:text-lg font-bold ${
                          staff.is_clocked_in
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                            : staff.is_wfh
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {staff.full_name.charAt(0)}
                        </div>
                        <div className="min-w-0 w-full">
                          <p className="font-semibold text-foreground text-xs sm:text-sm line-clamp-1 leading-snug">
                            {staff.full_name}
                          </p>
                          <span className={`text-[10px] sm:text-xs font-medium uppercase tracking-wide ${
                            staff.is_clocked_in
                              ? "text-emerald-600 dark:text-emerald-400"
                              : staff.is_wfh
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-muted-foreground"
                          }`}>
                            {staff.is_clocked_in ? "● IN" : staff.is_wfh ? "⌂ WFH" : "○ OUT"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Visitors Panel ─────────────────────────────── */}
            <div className={`flex-1 flex flex-col min-h-0 ${mobileTab !== "visitors" ? "hidden xl:flex" : "flex"}`}>
              <Card className="flex flex-col rounded-2xl border-brand-taupe/30 bg-card shadow-sm h-full">
                <CardContent className="flex flex-col items-center justify-center p-6 sm:p-10 gap-5 sm:gap-8 text-center flex-1">
                  <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-brand-taupe/15 flex items-center justify-center shrink-0">
                    <UserPlus className="h-7 w-7 sm:h-10 sm:w-10 text-brand-taupe" />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">Visitors</h2>
                    <p className="text-sm sm:text-lg text-muted-foreground mt-1">Please select an option below.</p>
                  </div>
                  <div className="flex flex-col w-full gap-3 sm:gap-4">
                    <Button
                      className="h-14 sm:h-20 w-full rounded-xl sm:rounded-2xl text-base sm:text-xl gap-2 sm:gap-3 bg-brand-taupe hover:bg-brand-taupe/90 text-white shadow-lg transition-all"
                      onClick={() => setMode("walk-in-form")}
                    >
                      <UserPlus className="h-5 w-5 sm:h-7 sm:w-7" /> Check In
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 sm:h-20 w-full rounded-xl sm:rounded-2xl text-base sm:text-xl gap-2 sm:gap-3 border-2 border-border hover:border-brand-taupe/40 hover:bg-brand-taupe/5 transition-colors"
                      onClick={() => setMode("visitor-checkout-list")}
                    >
                      <LogOut className="h-5 w-5 sm:h-7 sm:w-7 text-destructive" /> Check Out
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 sm:h-20 w-full rounded-xl sm:rounded-2xl text-base sm:text-xl gap-2 sm:gap-3 border-2 border-brand-taupe/30 hover:border-brand-taupe hover:bg-brand-taupe/5 transition-colors"
                      onClick={() => setMode("visitor-ref-entry")}
                    >
                      <BadgeCheck className="h-5 w-5 sm:h-7 sm:w-7 text-brand-taupe" /> I Have a Booking
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── STAFF PIN ─────────────────────────────────────── */}
        {mode === "staff-pin" && (
          <div className="flex flex-col items-center gap-6 sm:gap-8 w-full max-w-sm mx-auto px-4 py-6 z-10">
            <Button variant="ghost" className="self-start gap-2 rounded-xl text-muted-foreground" onClick={reset}>
              <ArrowLeft className="h-5 w-5" /> Back
            </Button>
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Staff Access</h2>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">Enter your PIN to continue</p>
            </div>
            <PinKeypad onComplete={handlePinComplete} />
          </div>
        )}

        {/* ── STAFF DONE ────────────────────────────────────── */}
        {mode === "staff-done" && (
          <div className="flex flex-col items-center gap-5 sm:gap-6 w-full max-w-md mx-auto px-4 py-8 text-center z-10">
            <div className="flex h-24 w-24 sm:h-32 sm:w-32 items-center justify-center rounded-full bg-success/20 animate-bounce">
              <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-success" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">Success!</h2>
            <p className="text-base sm:text-xl text-muted-foreground">Your attendance has been recorded.</p>
            <p className="text-sm text-muted-foreground">Returning in {countdown}s…</p>
            <Button variant="outline" className="rounded-2xl h-12 px-8 gap-2 mt-2" onClick={reset}>
              <ArrowLeft className="h-5 w-5" /> Back to Home
            </Button>
          </div>
        )}

        {/* ── WALK-IN FORM ──────────────────────────────────── */}
        {mode === "walk-in-form" && (
          <div className="flex flex-col w-full max-w-2xl mx-auto px-4 py-5 sm:py-8 z-10 overflow-y-auto">
            <Button variant="ghost" className="self-start gap-2 rounded-xl text-muted-foreground mb-4" onClick={reset}>
              <ArrowLeft className="h-5 w-5" /> Cancel
            </Button>
            <div className="mb-5 sm:mb-8">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">Visitor Registration</h2>
              <p className="text-sm sm:text-lg text-muted-foreground mt-1">Provide your details to notify your host.</p>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider">Full Name *</label>
                  <Input
                    value={walkInForm.name}
                    onChange={(e) => setWalkInForm({ ...walkInForm, name: e.target.value })}
                    placeholder="John Doe"
                    className="rounded-xl h-12 sm:h-16 text-base sm:text-lg border-2 border-border focus-visible:ring-brand-taupe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      value={walkInForm.phone}
                      onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                      placeholder="+44 7700 900000"
                      className="rounded-xl h-12 sm:h-16 text-base sm:text-lg pl-11 border-2 border-border focus-visible:ring-brand-taupe"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider">Company (Optional)</label>
                <Input
                  value={walkInForm.company}
                  onChange={(e) => setWalkInForm({ ...walkInForm, company: e.target.value })}
                  placeholder="Acme Corp"
                  className="rounded-xl h-12 sm:h-16 text-base sm:text-lg border-2 border-border focus-visible:ring-brand-taupe"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider">Who are you visiting? *</label>
                <Select value={walkInForm.hostId} onValueChange={(val) => setWalkInForm({ ...walkInForm, hostId: val })}>
                  <SelectTrigger className="rounded-xl h-12 sm:h-16 text-base sm:text-lg border-2 border-border focus:ring-brand-taupe">
                    <SelectValue placeholder="Select staff member..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {hosts.map(h => (
                      <SelectItem key={h.id} value={h.id} className="py-2 sm:py-3 text-base">{h.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="flex items-start gap-3 mb-5 bg-muted/30 p-3 sm:p-4 rounded-xl">
                  <Checkbox
                    id="consent"
                    checked={walkInForm.consent}
                    onCheckedChange={(v) => setWalkInForm({ ...walkInForm, consent: v === true })}
                    className="mt-0.5 h-5 w-5 rounded-md data-[state=checked]:bg-brand-taupe data-[state=checked]:border-brand-taupe"
                  />
                  <label htmlFor="consent" className="text-xs sm:text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to comply with the building's health, safety, and security protocols. My details will be recorded for security purposes.
                  </label>
                </div>
                <Button
                  className="w-full h-14 sm:h-20 rounded-xl sm:rounded-[1.5rem] text-lg sm:text-2xl font-bold bg-brand-taupe hover:bg-brand-taupe/90 text-white shadow-lg transition-all"
                  onClick={handleWalkInSubmit}
                  disabled={isPending || !walkInForm.name || !walkInForm.phone || !walkInForm.hostId || !walkInForm.consent}
                >
                  {isPending ? "Processing..." : "Finish Registration & Sign In"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── WALK-IN DONE ──────────────────────────────────── */}
        {mode === "walk-in-done" && (
          <div className="flex flex-col items-center gap-5 sm:gap-6 w-full max-w-lg mx-auto px-4 py-8 text-center z-10">
            <div className="flex h-24 w-24 sm:h-32 sm:w-32 items-center justify-center rounded-full bg-success/20 animate-bounce">
              <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-success" />
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">You're Checked In!</h2>
            <p className="text-sm sm:text-xl text-muted-foreground">Your host has been notified. Please take a seat.</p>
            <p className="text-sm text-muted-foreground">Returning in {countdown}s…</p>
            <Button variant="outline" className="rounded-2xl h-12 px-8 gap-2" onClick={reset}>
              <ArrowLeft className="h-5 w-5" /> Back to Home
            </Button>
          </div>
        )}

        {/* ── VISITOR CHECKOUT LIST ─────────────────────────── */}
        {mode === "visitor-checkout-list" && (
          <div className="flex flex-col w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 z-10 overflow-y-auto">
            <div className="flex items-center justify-between mb-5 sm:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Sign Out</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Tap your name to sign out.</p>
              </div>
              <Button variant="outline" className="gap-2 rounded-xl h-10 sm:h-14 px-4 sm:px-6 border-2" onClick={reset}>
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" /> <span className="hidden sm:inline">Cancel</span>
              </Button>
            </div>

            {activeVisitors.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 sm:p-20 bg-card rounded-2xl border border-border text-center">
                <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4 opacity-40" />
                <h3 className="text-xl sm:text-2xl font-semibold text-foreground">No Active Visitors</h3>
                <p className="text-sm sm:text-base text-muted-foreground mt-2">No one is currently checked in.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                {activeVisitors.map(v => (
                  <Card
                    key={v.id}
                    className="rounded-xl border-border bg-card shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer group"
                    onClick={() => handleCheckoutVisitor(v.id, v.visitor_name)}
                  >
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base sm:text-xl font-bold text-foreground group-hover:text-brand-taupe transition-colors">
                            {v.visitor_name}
                          </h3>
                          {v.company && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{v.company}</p>}
                        </div>
                        <LogOut className="h-5 w-5 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:text-destructive transition-all shrink-0" />
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Visiting</p>
                        <p className="font-medium text-sm text-foreground">{v.host_name}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CHECKOUT DONE ─────────────────────────────────── */}
        {mode === "checkout-done" && (
          <div className="flex flex-col items-center gap-5 sm:gap-6 w-full max-w-lg mx-auto px-4 py-8 text-center z-10">
            <div className="flex h-24 w-24 sm:h-32 sm:w-32 items-center justify-center rounded-full bg-success/20 animate-bounce">
              <LogOut className="h-12 w-12 sm:h-16 sm:w-16 text-success ml-1" />
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">Signed Out</h2>
            <p className="text-sm sm:text-xl text-muted-foreground">Thank you for visiting. Have a great day!</p>
            <p className="text-sm text-muted-foreground">Returning in {countdown}s…</p>
            <Button variant="outline" className="rounded-2xl h-12 px-8 gap-2" onClick={reset}>
              <ArrowLeft className="h-5 w-5" /> Back to Home
            </Button>
          </div>
        )}

        {/* ── VISITOR NAME SEARCH ───────────────────────────── */}
        {mode === "visitor-ref-entry" && (
          <div className="flex flex-col items-center gap-6 sm:gap-8 w-full max-w-sm mx-auto px-4 py-6 z-10">
            <Button variant="ghost" className="self-start gap-2 rounded-xl text-muted-foreground" onClick={reset}>
              <ArrowLeft className="h-5 w-5" /> Back
            </Button>
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">I Have a Booking</h2>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">Enter your name to find your booking</p>
            </div>
            <div className="w-full space-y-4">
              <input
                value={visitorNameSearch}
                onChange={(e) => setVisitorNameSearch(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full rounded-xl h-16 text-center text-xl font-semibold border-2 border-border bg-background text-foreground focus:outline-none focus:border-brand-taupe px-4"
              />
              <Button
                className="w-full h-14 rounded-xl text-lg font-bold bg-brand-taupe hover:bg-brand-taupe/90 text-white"
                disabled={visitorNameSearch.trim().length < 2 || isPending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await lookupVisitorByName(visitorNameSearch)
                    if (res.found && res.visitors) {
                      setVisitorMatches(res.visitors)
                      if (res.visitors.length === 1) {
                        setVisitorConfirmData(res.visitors[0])
                      }
                      setMode("visitor-ref-confirm")
                    } else {
                      toast.error(res.error || "No booking found for that name today")
                    }
                  })
                }}
              >
                {isPending ? "Searching…" : "Find My Booking"}
              </Button>
            </div>
          </div>
        )}

        {/* ── VISITOR CONFIRM ───────────────────────────────── */}
        {mode === "visitor-ref-confirm" && (
          <div className="flex flex-col items-center gap-6 sm:gap-8 w-full max-w-sm mx-auto px-4 py-6 z-10">
            <Button variant="ghost" className="self-start gap-2 rounded-xl text-muted-foreground" onClick={() => { setVisitorConfirmData(null); setMode("visitor-ref-entry") }}>
              <ArrowLeft className="h-5 w-5" /> Back
            </Button>
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                {visitorConfirmData ? "Confirm Check-In" : "Select Your Booking"}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                {visitorConfirmData ? "Is this you?" : "We found multiple bookings — tap yours"}
              </p>
            </div>

            {/* Multiple matches — pick one */}
            {!visitorConfirmData && (
              <div className="w-full space-y-3">
                {visitorMatches.map(v => (
                  <Card
                    key={v.id}
                    className="w-full rounded-2xl border-border shadow-sm hover:border-brand-taupe cursor-pointer transition-colors"
                    onClick={() => setVisitorConfirmData(v)}
                  >
                    <CardContent className="p-4">
                      <p className="text-base font-bold text-foreground">{v.visitor_name}</p>
                      {v.company && <p className="text-sm text-muted-foreground">{v.company}</p>}
                      <p className="text-xs text-muted-foreground mt-1">Visiting <span className="font-medium text-foreground">{v.host_name}</span></p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Single match or selected — confirm */}
            {visitorConfirmData && (
              <>
                <Card className="w-full rounded-2xl border-brand-taupe/30 shadow-sm">
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Visitor</p>
                      <p className="text-xl font-bold text-foreground">{visitorConfirmData.visitor_name}</p>
                      {visitorConfirmData.company && <p className="text-sm text-muted-foreground mt-0.5">{visitorConfirmData.company}</p>}
                    </div>
                    <div className="border-t border-border pt-4">
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Visiting</p>
                      <p className="text-base font-semibold text-foreground">{visitorConfirmData.host_name}</p>
                    </div>
                  </CardContent>
                </Card>
                <Button
                  className="w-full h-14 rounded-xl text-lg font-bold bg-brand-taupe hover:bg-brand-taupe/90 text-white"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await checkinVisitor(visitorConfirmData.id)
                      if (res.success) {
                        setMode("walk-in-done")
                      } else {
                        toast.error(res.error || "Check-in failed. Please see reception.")
                      }
                    })
                  }}
                >
                  {isPending ? "Checking in…" : "Yes, Check Me In"}
                </Button>
                {visitorMatches.length > 1 && (
                  <Button variant="ghost" className="text-sm text-muted-foreground" onClick={() => setVisitorConfirmData(null)}>
                    That's not me — go back
                  </Button>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="flex items-center justify-center gap-4 border-t border-border bg-card px-4 py-2.5 z-10 shrink-0">
        <p className="text-xs text-muted-foreground">
          Designed and Developed by{" "}
          <a href="https://sarmalinux.com" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4 hover:text-brand-taupe transition-colors">
            Sarma Linux
          </a>
        </p>
      </footer>
    </div>
  )
}
