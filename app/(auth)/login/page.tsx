"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from "lucide-react"
import { signIn } from "@/lib/actions/auth"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setHint(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) {
        setError(result.error)
        if (result.code === "email_not_confirmed") {
          setHint("Need a new link? Go to the verify email page.")
        }
      }
    })
  }

  return (
    <div className="fixed inset-0 flex">

      {/* ── Left brand panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col overflow-hidden" style={{ background: '#0f1623' }}>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12">

          {/* Logo */}
          <img
            src="/logo.png"
            alt="StaffPortal"
            className="h-9 w-auto object-contain self-start brightness-0 invert"
          />

          {/* Hero text */}
          <div className="mt-auto">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 border border-white/10" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: '#f59e0b' }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#f59e0b' }}>StaffPortal</span>
            </div>

            <h1 className="text-5xl font-black leading-tight tracking-tight mb-4 text-white">
              Your team,<br />
              <span style={{ color: '#f59e0b' }}>beautifully</span><br />
              managed.
            </h1>
            <p className="text-sm leading-relaxed max-w-sm" style={{ color: '#64748b' }}>
              Attendance, leave, timesheets and more — all in one place for your team.
            </p>

            {/* Stats */}
            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { value: "100%", label: "Paperless" },
                { value: "Real-time", label: "Attendance" },
                { value: "One place", label: "Everything" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl p-4 border" style={{ background: '#1e2d3d', borderColor: '#2d3f52' }}>
                  <p className="text-lg font-black text-white">{s.value}</p>
                  <p className="text-xs mt-0.5 font-medium" style={{ color: '#64748b' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ borderLeft: '4px solid #f59e0b' }}>

        {/* Mobile: fashion image behind form */}
        <div
          className="lg:hidden fixed inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80')",
            zIndex: -2
          }}
        />
        <div className="lg:hidden fixed inset-0" style={{ background: 'rgba(15,22,35,0.82)', zIndex: -1 }} />

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#f8fafc] lg:bg-[#f8fafc]">

          {/* Mobile: logo above card */}
          <div className="lg:hidden mb-8 text-center">
            <img
              src="/logo.png"
              alt="StaffPortal"
              className="h-10 mx-auto"
            />
            <p className="text-white/60 text-sm mt-3">Your team, beautifully managed.</p>
          </div>

          <div className="w-full max-w-sm">

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-3xl font-black" style={{ color: '#0f1623' }}>Welcome back</h2>
              <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                Sign in to your StaffPortal account
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 mb-5">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">{error}</p>
                  {hint && (
                    <p className="text-xs text-destructive/80 mt-0.5">
                      {hint}{" "}
                      <Link href="/verify-email" className="underline">Resend link</Link>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold" style={{ color: '#374151' }}>Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@yourcompany.com"
                  className="h-11 rounded-xl border-[1.5px] focus:border-amber-400 bg-white"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold" style={{ color: '#374151' }}>Password</Label>
                  <Link href="/forgot-password" className="text-xs font-semibold transition-opacity hover:opacity-75" style={{ color: '#f59e0b' }}>
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-11 rounded-xl border-[1.5px] focus:border-amber-400 pr-10 bg-white"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-bold gap-2 text-white"
                style={{ background: '#0f1623' }}
                disabled={isPending}
              >
                {isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                  : <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>
                }
              </Button>
            </form>

            {/* Kiosk */}
            <div className="mt-3">
              <Button variant="outline" type="button" className="w-full h-11 rounded-xl border-[1.5px] font-semibold" asChild>
                <Link href="/kiosk">Open Kiosk View</Link>
              </Button>
            </div>

            {/* Footer links */}
            <div className="mt-8 pt-6 border-t space-y-3 text-center">
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                Only{" "}
                <span className="font-semibold rounded px-1 py-0.5" style={{ background: '#fef3c7', color: '#92400e' }}>
                  @yourcompany.com
                </span>{" "}
                accounts are permitted
              </p>
              <p className="text-sm" style={{ color: '#64748b' }}>
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-bold hover:opacity-75 transition-opacity" style={{ color: '#f59e0b' }}>
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs pb-6 bg-[#f8fafc]" style={{ color: '#94a3b8' }}>
          Designed and developed by{" "}
          <a
            href="https://sarmalinux.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4 hover:opacity-75 transition-colors"
            style={{ color: '#0f1623' }}
          >
            Sarma Linux
          </a>
        </p>
      </div>
    </div>
  )
}
