"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const CATEGORIES = ["Facilities", "HR", "Management", "IT", "Conduct", "Safety", "Other"]
const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
]

interface Props {
  users: { id: string; name: string }[]
  currentUserId: string
}

export default function NewComplaintClient({ users, currentUserId }: Props) {
  const router = useRouter()
  const [recipientId, setRecipientId] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState("Other")
  const [severity, setSeverity] = useState("medium")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!recipientId) { toast.error("Please select who you are sending this complaint to"); return }
    if (!subject.trim() || !message.trim()) { toast.error("Please fill in all fields"); return }
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from("complaints").insert({
        user_id: isAnonymous ? null : currentUserId,
        recipient_id: recipientId,
        subject: subject.trim(),
        message: message.trim(),
        category: category.toLowerCase(),
        severity: severity as any,
        is_anonymous: isAnonymous,
        status: "submitted",
      })
      if (error) { toast.error(error.message); return }
      toast.success("Complaint submitted!")
      router.push("/complaints")
    })
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/complaints"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Raise a Complaint</h1>
          <p className="text-sm text-muted-foreground">Submit a formal workplace complaint</p>
        </div>
      </div>

      <Card className="rounded-2xl border-border shadow-sm max-w-2xl">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Send to <span className="text-destructive">*</span></Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select person…" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary…" className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Details</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please describe the issue in as much detail as possible…"
              className="rounded-xl min-h-[140px]"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <Switch id="anon" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            <div>
              <Label htmlFor="anon" className="cursor-pointer font-medium">Submit anonymously</Label>
              <p className="text-xs text-muted-foreground">Your name will not be linked to this complaint</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href="/complaints">Cancel</Link>
            </Button>
            <Button className="rounded-xl gap-2" onClick={handleSubmit} disabled={isPending}>
              <CheckCircle className="h-4 w-4" />{isPending ? "Submitting…" : "Submit Complaint"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
