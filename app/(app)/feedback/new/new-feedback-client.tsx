"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const CATEGORIES = ["General", "Facilities", "IT", "HR", "Management", "Processes", "Praise", "Other"]

interface Props {
  users: { id: string; name: string }[]
  currentUserId: string
}

export default function NewFeedbackClient({ users, currentUserId }: Props) {
  const router = useRouter()
  const [recipientId, setRecipientId] = useState("")
  const [category, setCategory] = useState("General")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!recipientId) { toast.error("Please select who you are sending feedback to"); return }
    if (!subject.trim() || !message.trim()) { toast.error("Please fill in all fields"); return }
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from("feedback").insert({
        user_id: currentUserId,
        recipient_id: recipientId,
        subject: subject.trim(),
        message: message.trim(),
        category: category.toLowerCase(),
        status: "submitted",
      })
      if (error) { toast.error(error.message); return }
      toast.success("Feedback submitted!")
      router.push("/feedback")
    })
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/feedback"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Give Feedback</h1>
          <p className="text-sm text-muted-foreground">Share suggestions or comments with a colleague</p>
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
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Textarea
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your feedback…"
              className="rounded-xl min-h-[60px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please provide as much detail as possible…"
              className="rounded-xl min-h-[120px]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href="/feedback">Cancel</Link>
            </Button>
            <Button className="rounded-xl gap-2" onClick={handleSubmit} disabled={isPending}>
              <CheckCircle className="h-4 w-4" />{isPending ? "Submitting…" : "Submit Feedback"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
