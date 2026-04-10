"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Mail, Phone, MessageCircle, Globe, Linkedin, Instagram,
  Twitter, Camera, Settings, Building2, Calendar, Cake, Hash,
  MapPin, Clock, Home, Plane, AlertCircle, LogOut, Pencil, Check, X, Loader2, Move,
} from "lucide-react"
import { toast } from "sonner"
import { getCoverUploadUrl, saveCoverUrl, saveCoverPosition, updateJoinedAt } from "@/lib/actions/settings"

interface Profile {
  id: string
  full_name: string
  display_name: string | null
  job_title: string | null
  email: string
  phone: string | null
  desk_extension: string | null
  gender: string | null
  avatar_url: string | null
  cover_photo_url: string | null
  bio: string | null
  hobbies: string[] | null
  linkedin_url: string | null
  instagram_url: string | null
  twitter_url: string | null
  facebook_url: string | null
  discord_url: string | null
  teams_url: string | null
  website_url: string | null
  cover_position: number | null
}

interface Props {
  profile: Profile
  deptName: string | null
  statusType: "in_office" | "wfh" | "on_leave" | "running_late" | "clocked_out" | "not_in"
  sinceLabel: string
  joinedYear: number
  birthdayDisplay: string | null
  isOwnProfile: boolean
  joinedAtISO: string
}

const STATUS_CONFIG = {
  in_office:    { label: "In Office",          dot: "bg-emerald-500",   badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800", Icon: Clock },
  wfh:          { label: "Working from Home",  dot: "bg-blue-500",      badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800", Icon: Home },
  on_leave:     { label: "On Leave",           dot: "bg-amber-500",     badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800", Icon: Plane },
  running_late: { label: "Running Late",       dot: "bg-orange-500",    badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800", Icon: AlertCircle },
  clocked_out:  { label: "Left Office",        dot: "bg-slate-400",     badge: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-950/40 dark:text-slate-400 dark:border-slate-700", Icon: LogOut },
  not_in:       { label: "Not In Today",       dot: "bg-slate-300",     badge: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-950/40 dark:text-slate-400 dark:border-slate-700", Icon: LogOut },
}

const HOBBY_COLORS = [
  "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800",
  "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
  "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800",
  "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800",
  "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
  "bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800",
]

export function ProfileClient({ profile, deptName, statusType, sinceLabel, joinedYear, birthdayDisplay, isOwnProfile, joinedAtISO }: Props) {
  const router = useRouter()
  const coverRef = useRef<HTMLInputElement>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(profile.cover_photo_url)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverPos, setCoverPos] = useState(profile.cover_position ?? 50)
  const [repositioning, setRepositioning] = useState(false)
  const [dragStart, setDragStart] = useState<{ y: number; startPos: number } | null>(null)
  const [savingPos, setSavingPos] = useState(false)
  const coverContainerRef = useRef<HTMLDivElement>(null)
  const posBeforeEdit = useRef(profile.cover_position ?? 50)
  const [editingJoined, setEditingJoined] = useState(false)
  const [joinedInput, setJoinedInput] = useState(joinedAtISO)
  const [savingJoined, setSavingJoined] = useState(false)

  const name = profile.display_name || profile.full_name || "—"
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  const rawPhone = profile.phone ?? ""
  const displayPhone = rawPhone
    ? rawPhone.startsWith("+") ? rawPhone
      : rawPhone.startsWith("0") ? "+44 " + rawPhone.slice(1)
      : rawPhone
    : null
  const waDigits = rawPhone.replace(/\D/g, "")
  const waNumber = waDigits.startsWith("0") ? "44" + waDigits.slice(1) : waDigits
  const waLink = waNumber ? `https://wa.me/${waNumber}` : null

  const status = STATUS_CONFIG[statusType]
  const StatusIcon = status.Icon

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverUploading(true)
    try {
      const urlResult = await getCoverUploadUrl(file.type, profile.id)
      if (!urlResult.success || !urlResult.signedUrl) { toast.error(urlResult.error ?? "Upload failed"); return }
      const uploadResp = await fetch(urlResult.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
      if (!uploadResp.ok) { toast.error("Upload failed — please try again"); return }
      const saveResult = await saveCoverUrl(urlResult.publicUrl!)
      if (!saveResult.success) { toast.error(saveResult.error ?? "Failed to save cover"); return }
      setCoverUrl(saveResult.url ?? null)
      toast.success("Cover photo updated!")
    } catch {
      toast.error("Upload failed — please try again")
    } finally {
      setCoverUploading(false)
      e.target.value = ""
    }
  }

  const handleDragStart = useCallback((clientY: number) => {
    setDragStart({ y: clientY, startPos: coverPos })
  }, [coverPos])

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragStart || !coverContainerRef.current) return
    const containerH = coverContainerRef.current.offsetHeight
    const delta = dragStart.y - clientY
    const pctDelta = (delta / containerH) * 100
    setCoverPos(Math.max(0, Math.min(100, dragStart.startPos + pctDelta)))
  }, [dragStart])

  const handleDragEnd = useCallback(() => { setDragStart(null) }, [])

  useEffect(() => {
    if (!repositioning || !dragStart) return
    const onMove = (e: MouseEvent) => handleDragMove(e.clientY)
    const onTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientY)
    const onUp = () => handleDragEnd()
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onUp)
    }
  }, [repositioning, dragStart, handleDragMove, handleDragEnd])

  const handleSaveCoverPos = async () => {
    setSavingPos(true)
    const result = await saveCoverPosition(coverPos)
    setSavingPos(false)
    if (result.success) {
      toast.success("Cover position saved")
      posBeforeEdit.current = coverPos
      setRepositioning(false)
    } else {
      toast.error(result.error ?? "Failed to save position")
    }
  }

  const handleCancelReposition = () => {
    setCoverPos(posBeforeEdit.current)
    setRepositioning(false)
  }

  const handleSaveJoined = async () => {
    if (!joinedInput) return
    setSavingJoined(true)
    const result = await updateJoinedAt(joinedInput)
    setSavingJoined(false)
    if (result.success) {
      toast.success("Joined date updated")
      setEditingJoined(false)
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to update")
    }
  }

  const hasSocial = profile.linkedin_url || profile.instagram_url || profile.twitter_url || profile.facebook_url || profile.discord_url || profile.teams_url || profile.website_url

  return (
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-xl border border-border px-3 py-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Directory
        </button>
        <span className="text-sm font-bold text-foreground">{name}</span>
        {isOwnProfile && (
          <button
            onClick={() => router.push("/settings")}
            className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-xl border border-border px-3 py-1.5 hover:bg-muted"
          >
            <Settings className="h-3.5 w-3.5" />
            Edit Profile
          </button>
        )}
      </div>

      <div className="max-w-[1400px] mx-auto">
        {/* Profile card */}
        <div className="bg-card border-b border-border md:border md:rounded-3xl md:m-3 md:overflow-hidden md:shadow-sm">

          {/* Cover photo */}
          <div
            ref={coverContainerRef}
            className={`relative h-44 md:h-64 lg:h-72 overflow-hidden bg-gradient-to-br from-brand-taupe/80 via-brand-taupe to-stone-700 ${repositioning ? "cursor-grab active:cursor-grabbing" : ""}`}
            onMouseDown={repositioning ? (e) => { e.preventDefault(); handleDragStart(e.clientY) } : undefined}
            onTouchStart={repositioning ? (e) => handleDragStart(e.touches[0].clientY) : undefined}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Cover"
                className="w-full h-full object-cover select-none pointer-events-none"
                style={{ objectPosition: `center ${coverPos}%` }}
                draggable={false}
              />
            ) : (
              <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #c8a882 0%, #8b6f4e 50%, #5c4a35 100%)" }}>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
              </div>
            )}
            {!repositioning && <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />}
            {repositioning && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                <p className="text-white text-sm font-bold bg-black/50 px-4 py-2 rounded-xl backdrop-blur">Drag to reposition</p>
              </div>
            )}
            {isOwnProfile && !repositioning && (
              <div className="absolute top-3 right-3 flex gap-2">
                {coverUrl && (
                  <button
                    onClick={() => { posBeforeEdit.current = coverPos; setRepositioning(true) }}
                    className="flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 backdrop-blur transition-colors"
                  >
                    <Move className="h-3.5 w-3.5" />
                    Reposition
                  </button>
                )}
                <button
                  onClick={() => coverRef.current?.click()}
                  disabled={coverUploading}
                  className="flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 backdrop-blur transition-colors"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {coverUploading ? "Uploading..." : "Edit Cover"}
                </button>
              </div>
            )}
            {repositioning && (
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button onClick={handleCancelReposition} className="flex items-center gap-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 backdrop-blur transition-colors">
                  <X className="h-3.5 w-3.5" />Cancel
                </button>
                <button onClick={handleSaveCoverPos} disabled={savingPos} className="flex items-center gap-1.5 bg-white hover:bg-white/90 text-black text-xs font-bold px-3 py-1.5 rounded-xl transition-colors">
                  {savingPos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </button>
              </div>
            )}
            <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverChange} />
          </div>

          {/* Header: avatar + info */}
          <div className="px-4 md:px-8 pb-6">
            {/* Avatar row — only avatar overlaps cover, name stays below */}
            <div className="flex items-end justify-between">
              <div className="relative shrink-0 -mt-12 md:-mt-16">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-card bg-muted overflow-hidden shadow-lg">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-taupe/20 to-brand-taupe/40 text-brand-taupe font-black text-3xl md:text-4xl">
                      {initials}
                    </div>
                  )}
                </div>
                <span className={`absolute bottom-1.5 right-1.5 w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-card ${status.dot}`} />
              </div>
              {/* Action buttons — top right on desktop */}
              <div className="hidden md:flex gap-2 pt-3">
                <a href={`mailto:${profile.email}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                  <Mail className="h-4 w-4" />Email
                </a>
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 text-sm font-bold hover:opacity-80 transition-opacity">
                    <MessageCircle className="h-4 w-4" />WhatsApp
                  </a>
                )}
                {rawPhone && (
                  <a href={`tel:${rawPhone}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-foreground text-sm font-bold hover:bg-muted transition-colors">
                    <Phone className="h-4 w-4" />Call
                  </a>
                )}
              </div>
            </div>

            {/* Name + badges — always below cover, never hidden */}
            <div className="mt-3">
              <h1 className="text-xl md:text-2xl font-extrabold text-foreground leading-tight">{name}</h1>
              {profile.job_title && (
                <p className="text-sm text-muted-foreground mt-0.5">{profile.job_title}{deptName ? ` · ${deptName}` : ""}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2.5">
                {deptName && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                    <Building2 className="h-3 w-3" />{deptName}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${status.badge}`}>
                  <StatusIcon className="h-3 w-3" />{status.label}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                  <Calendar className="h-3 w-3" />Since {joinedYear} · {sinceLabel}
                </span>
              </div>
            </div>

            {/* Action buttons — mobile only */}
            <div className="flex md:hidden flex-wrap gap-2 mt-4">
              <a href={`mailto:${profile.email}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                <Mail className="h-4 w-4" />Email
              </a>
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 text-sm font-bold hover:opacity-80 transition-opacity">
                  <MessageCircle className="h-4 w-4" />WhatsApp
                </a>
              )}
              {rawPhone && (
                <a href={`tel:${rawPhone}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-foreground text-sm font-bold hover:bg-muted transition-colors">
                  <Phone className="h-4 w-4" />Call
                </a>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="border-t border-border grid grid-cols-1 md:grid-cols-[260px_1fr]">

            {/* LEFT COLUMN */}
            <div className="border-b md:border-b-0 md:border-r border-border p-5 md:p-6 space-y-6">

              {/* Contact */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Contact</p>
                <div className="space-y-2">
                  <a href={`mailto:${profile.email}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Email</p>
                      <p className="text-xs font-semibold text-foreground truncate">{profile.email}</p>
                    </div>
                  </a>
                  {displayPhone && (
                    <a href={`tel:${rawPhone}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                        <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Mobile</p>
                        <p className="text-xs font-semibold text-foreground">{displayPhone}</p>
                      </div>
                    </a>
                  )}
                  {profile.desk_extension && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Desk Extension</p>
                        <p className="text-xs font-semibold text-foreground">Ext {profile.desk_extension}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Social Links */}
              {hasSocial && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Social & Links</p>
                  <div className="space-y-2">
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-[#0077b5] flex items-center justify-center shrink-0">
                          <Linkedin className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">LinkedIn</span>
                      </a>
                    )}
                    {profile.instagram_url && (
                      <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }}>
                          <Instagram className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">Instagram</span>
                      </a>
                    )}
                    {profile.twitter_url && (
                      <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                          <Twitter className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">X / Twitter</span>
                      </a>
                    )}
                    {profile.facebook_url && (
                      <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center shrink-0">
                          <span className="text-white font-black text-sm leading-none">f</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">Facebook</span>
                      </a>
                    )}
                    {profile.discord_url && (
                      <a href={profile.discord_url.startsWith("http") ? profile.discord_url : `https://discord.com/users/${profile.discord_url}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-[#5865F2] flex items-center justify-center shrink-0">
                          <span className="text-white font-black text-[10px] leading-none">DC</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">Discord</span>
                      </a>
                    )}
                    {profile.teams_url && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30">
                        <div className="w-8 h-8 rounded-lg bg-[#6264A7] flex items-center justify-center shrink-0">
                          <span className="text-white font-black text-[10px] leading-none">TM</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate">{profile.teams_url}</span>
                      </div>
                    )}
                    {profile.website_url && (
                      <a href={profile.website_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">Website</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* At a Glance */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">At a Glance</p>
                <div className="space-y-2">
                  {deptName && (
                    <div className="flex justify-between items-center py-2 border-b border-border/40">
                      <span className="text-xs text-muted-foreground">Department</span>
                      <span className="text-xs font-semibold text-foreground">{deptName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-border/40">
                    <span className="text-xs text-muted-foreground">Joined</span>
                    {editingJoined ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={joinedInput}
                          onChange={e => setJoinedInput(e.target.value)}
                          className="text-xs font-semibold text-foreground bg-background border border-border rounded-lg px-2 py-1 w-[130px]"
                        />
                        <button onClick={handleSaveJoined} disabled={savingJoined} className="p-1 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                          {savingJoined ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : <Check className="h-3 w-3 text-emerald-600" />}
                        </button>
                        <button onClick={() => { setEditingJoined(false); setJoinedInput(joinedAtISO) }} className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {joinedYear}
                        {isOwnProfile && (
                          <button onClick={() => setEditingJoined(true)} className="p-0.5 rounded hover:bg-muted transition-colors" title="Edit joined date">
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/40">
                    <span className="text-xs text-muted-foreground">With Memo</span>
                    <span className="text-xs font-semibold text-foreground">{sinceLabel}</span>
                  </div>
                  {birthdayDisplay && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Cake className="h-3 w-3" />Birthday</span>
                      <span className="text-xs font-semibold text-foreground">{birthdayDisplay}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN */}
            <div className="p-5 md:p-6 space-y-6">

              {/* About / Bio */}
              {profile.bio ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">About</p>
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
                  </div>
                </div>
              ) : isOwnProfile ? (
                <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                  <p className="text-sm text-muted-foreground">No bio yet.</p>
                  <button onClick={() => router.push("/settings")} className="text-sm font-semibold text-primary mt-1 hover:underline">
                    Add one in Settings
                  </button>
                </div>
              ) : null}

              {/* Hobbies */}
              {(profile.hobbies ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Hobbies & Interests</p>
                  <div className="flex flex-wrap gap-2">
                    {(profile.hobbies ?? []).map((h, i) => (
                      <span key={h} className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${HOBBY_COLORS[i % HOBBY_COLORS.length]}`}>
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Hobbies empty state for own profile */}
              {(profile.hobbies ?? []).length === 0 && isOwnProfile && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Hobbies & Interests</p>
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center">
                    <p className="text-sm text-muted-foreground">No hobbies added yet.</p>
                    <button onClick={() => router.push("/settings")} className="text-sm font-semibold text-primary mt-1 hover:underline">
                      Add in Settings
                    </button>
                  </div>
                </div>
              )}

              {/* Work Details */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Work Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {profile.job_title && (
                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Job Title</p>
                      <p className="text-sm font-bold text-foreground mt-1 leading-tight">{profile.job_title}</p>
                    </div>
                  )}
                  {deptName && (
                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Department</p>
                      <p className="text-sm font-bold text-foreground mt-1">{deptName}</p>
                    </div>
                  )}
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Today</p>
                    <p className={`text-sm font-bold mt-1 flex items-center gap-1.5 ${
                      statusType === "in_office" ? "text-emerald-600 dark:text-emerald-400" :
                      statusType === "wfh" ? "text-blue-600 dark:text-blue-400" :
                      statusType === "on_leave" ? "text-amber-600 dark:text-amber-400" :
                      statusType === "running_late" ? "text-orange-600 dark:text-orange-400" :
                      "text-muted-foreground"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                      {status.label}
                    </p>
                  </div>
                  {profile.desk_extension && (
                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Desk Extension</p>
                      <p className="text-sm font-bold text-foreground mt-1">Ext {profile.desk_extension}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Edit prompt for own profile with no content */}
              {isOwnProfile && !profile.bio && (profile.hobbies ?? []).length === 0 && !hasSocial && (
                <div className="rounded-2xl border border-dashed border-border p-5 text-center bg-muted/10">
                  <p className="text-sm font-semibold text-foreground">Make your profile shine</p>
                  <p className="text-xs text-muted-foreground mt-1">Add your bio, hobbies, and social links so your colleagues know you better.</p>
                  <button
                    onClick={() => router.push("/settings")}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <Settings className="h-4 w-4" />Go to Settings
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
