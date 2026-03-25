"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { Label } from "@/components/ui/label"
import { Users, UserPlus, Trash2, Plus, X, Building2, Mail, Phone, Pencil, MessageCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { addContact, updateContact, deleteContact } from "@/lib/actions/contacts"

interface StaffMember {
  id: string
  full_name: string
  display_name: string | null
  job_title: string | null
  email: string
  phone: string | null
  gender?: string | null
  desk_extension?: string | null
  department_id: string | null
  avatar_url?: string | null
  departments: { name: string } | null
}

interface ExternalContact {
  id: string
  added_by: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  notes: string | null
  created_at: string
}

interface Props {
  staff: StaffMember[]
  contacts: ExternalContact[]
  currentUserId: string
  initialTab: string
  initialQ: string
}

export default function DirectoryClient({ staff, contacts, currentUserId, initialTab, initialQ }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"staff" | "external">(initialTab === "external" ? "external" : "staff")
  const [q, setQ] = useState(initialQ)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editContact, setEditContact] = useState<ExternalContact | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (tab === "external") params.set("tab", "external")
    router.push(`/directory?${params.toString()}`)
  }

  const handleTabChange = (newTab: "staff" | "external") => {
    setTab(newTab)
    setQ("")
    const params = new URLSearchParams()
    if (newTab === "external") params.set("tab", "external")
    router.push(`/directory?${params.toString()}`)
  }

  const handleAdd = (formData: FormData) => {
    startTransition(async () => {
      const result = await addContact({
        name: formData.get("name") as string,
        company: formData.get("company") as string || undefined,
        email: formData.get("email") as string || undefined,
        phone: formData.get("phone") as string || undefined,
        job_title: formData.get("job_title") as string || undefined,
        notes: formData.get("notes") as string || undefined,
      })
      if (result.success) {
        toast.success("Contact added")
        setShowAddForm(false)
      } else {
        toast.error(result.error ?? "Failed to add contact")
      }
    })
  }

  const handleEditSubmit = (formData: FormData) => {
    if (!editContact) return
    startTransition(async () => {
      const result = await updateContact(editContact.id, {
        name: formData.get("name") as string,
        company: formData.get("company") as string || undefined,
        email: formData.get("email") as string || undefined,
        phone: formData.get("phone") as string || undefined,
        job_title: formData.get("job_title") as string || undefined,
        notes: formData.get("notes") as string || undefined,
      })
      if (result.success) {
        toast.success("Contact updated")
        setEditContact(null)
      } else {
        toast.error(result.error ?? "Failed to update contact")
      }
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Remove ${name} from contacts?`)) return
    startTransition(async () => {
      await deleteContact(id)
      toast.success("Contact removed")
    })
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Directory</h1>
          <p className="text-sm text-muted-foreground">Find colleagues and external contacts</p>
        </div>
        {tab === "external" && !showAddForm && (
          <Button className="rounded-xl gap-2" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />Add Contact
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => handleTabChange("staff")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "staff"
              ? "border-brand-taupe text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />Staff ({staff.length})
          </span>
        </button>
        <button
          onClick={() => handleTabChange("external")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "external"
              ? "border-brand-taupe text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />External ({contacts.length})
          </span>
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "staff" ? "Search by name, email, or role…" : "Search by name, email, or company…"}
          className="rounded-xl"
        />
        <Button type="submit" variant="outline" className="rounded-xl shrink-0">Search</Button>
      </form>

      {/* Add External Contact Form */}
      {tab === "external" && showAddForm && (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Add External Contact</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setShowAddForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form action={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name *</Label>
                <Input name="name" required placeholder="Jane Smith" className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company</Label>
                <Input name="company" placeholder="Acme Ltd" className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input name="email" type="email" placeholder="jane@acme.com" className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input name="phone" placeholder="+44 7700 000000" className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Job Title</Label>
                <Input name="job_title" placeholder="Account Manager" className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Input name="notes" placeholder="Optional notes" className="rounded-xl h-9" />
              </div>
              <div className="sm:col-span-2 flex gap-2 pt-1">
                <Button type="submit" className="rounded-xl" disabled={isPending}>
                  {isPending ? "Saving…" : "Save Contact"}
                </Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Staff Grid */}
      {tab === "staff" && (
        staff.length === 0 ? (
          <EmptyState
            icon={<Users className="h-7 w-7 text-muted-foreground" />}
            title="No people found"
            description={initialQ ? "Try a different search term." : "No active users in the system yet."}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {staff.map((p) => {
              const name = p.display_name || p.full_name || "—"
              const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
              const dept = (p.departments as any)?.name
              // Format phone with UK country code if needed
              const rawPhone = p.phone ?? ""
              const displayPhone = rawPhone
                ? rawPhone.startsWith("+") ? rawPhone
                  : rawPhone.startsWith("0") ? "+44 " + rawPhone.slice(1)
                  : rawPhone
                : null
              // WhatsApp link: digits only with country code
              const waDigits = rawPhone.replace(/\D/g, "")
              const waNumber = waDigits.startsWith("0") ? "44" + waDigits.slice(1) : waDigits.startsWith("44") ? waDigits : waDigits
              const waLink = waNumber ? `https://wa.me/${waNumber}` : null

              return (
                <div key={p.id} className="group rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
                  {/* Top section — avatar centred */}
                  <div className="flex flex-col items-center pt-7 pb-5 px-5 gap-3 flex-1">
                    {/* Avatar */}
                    <div className="h-20 w-20 rounded-full border-2 border-border shadow-sm shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt={name} className="h-full w-full object-cover" />
                        : <span className="text-2xl font-bold text-muted-foreground">{initials}</span>
                      }
                    </div>

                    {/* Name + title */}
                    <div className="text-center space-y-0.5">
                      <p className="text-[15px] font-bold text-foreground leading-tight">{name}</p>
                      <p className="text-xs text-muted-foreground leading-snug">{p.job_title || "—"}</p>
                    </div>

                    {/* Department badge */}
                    {dept && (
                      <Badge variant="secondary" className="text-[10px] px-2.5 py-0.5 rounded-full">{dept}</Badge>
                    )}

                    {/* Desk extension */}
                    {p.desk_extension && (
                      <p className="text-[11px] text-muted-foreground">Ext: {p.desk_extension}</p>
                    )}

                    {/* Email row */}
                    {p.email && (
                      <p className="text-[11px] text-muted-foreground truncate w-full text-center">{p.email}</p>
                    )}

                    {/* Phone with country code */}
                    {displayPhone && (
                      <p className="text-[11px] text-muted-foreground">{displayPhone}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 border-t border-border divide-x divide-border">
                    <a
                      href={`mailto:${p.email}`}
                      className="flex flex-col items-center gap-1 py-3 text-[10px] font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                      title={`Email ${name}`}
                    >
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </a>
                    <a
                      href={rawPhone ? `tel:${rawPhone}` : undefined}
                      className={`flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${rawPhone ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer" : "text-muted-foreground/30 cursor-default pointer-events-none"}`}
                      title={rawPhone ? `Call ${name}` : "No phone number"}
                    >
                      <Phone className="h-4 w-4" />
                      <span>Call</span>
                    </a>
                    <a
                      href={waLink ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${waLink ? "text-[#25D366] hover:bg-green-50 dark:hover:bg-green-950/30 cursor-pointer" : "text-muted-foreground/30 cursor-default pointer-events-none"}`}
                      title={waLink ? `WhatsApp ${name}` : "No phone number"}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* External Contacts List */}
      {tab === "external" && !showAddForm && (
        contacts.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-7 w-7 text-muted-foreground" />}
            title="No external contacts"
            description="Add clients, suppliers, and other external contacts to the shared directory."
            action={
              <Button className="rounded-xl gap-2" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4" />Add First Contact
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <Card key={c.id} className="rounded-2xl border-border shadow-sm">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold text-sm">
                      {c.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">{c.name}</p>
                      {c.job_title && (
                        <p className="text-xs text-muted-foreground">{c.job_title}</p>
                      )}
                      {c.company && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{c.company}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-xs text-brand-taupe hover:underline flex items-center gap-1">
                            <Mail className="h-3 w-3" />{c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />{c.phone}
                          </a>
                        )}
                      </div>
                      {c.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{c.notes}</p>}
                    </div>
                  </div>
                  {(c.added_by === currentUserId) && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                        onClick={() => setEditContact(c)}
                        disabled={isPending}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Edit Contact Dialog */}
      <Dialog open={!!editContact} onOpenChange={(open) => { if (!open) setEditContact(null) }}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          {editContact && (
            <form action={handleEditSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name *</Label>
                <Input name="name" required defaultValue={editContact.name} className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company</Label>
                <Input name="company" defaultValue={editContact.company ?? ""} placeholder="Acme Ltd" className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input name="email" type="email" defaultValue={editContact.email ?? ""} className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input name="phone" defaultValue={editContact.phone ?? ""} className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Job Title</Label>
                <Input name="job_title" defaultValue={editContact.job_title ?? ""} className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Input name="notes" defaultValue={editContact.notes ?? ""} className="rounded-xl h-9" />
              </div>
              <DialogFooter className="sm:col-span-2 pt-1">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditContact(null)}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={isPending}>{isPending ? "Saving…" : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
