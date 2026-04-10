"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RichEditor } from "@/components/shared/rich-editor"
import { ArrowLeft, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getCurrentUser } from "@/lib/actions/auth"

export default function NewDiaryEntryPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [tags, setTags] = useState("")
  const [reminder, setReminder] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Title is required"); return }
    startTransition(async () => {
      const supabase = createClient()
      const user = (await getCurrentUser())!
      if (!user) { toast.error("Not authenticated"); return }

      const tagList = tags.split(",").map(t => t.trim()).filter(Boolean)

      const { error } = await supabase.from("diary_entries").insert({
        user_id: user.id,
        title: title.trim(),
        content: content || null,
        tags: tagList,
        reminder_at: reminder ? new Date(reminder + "T07:00:00").toISOString() : null,
      })

      if (error) { toast.error(error.message); return }
      toast.success("Diary entry saved!")
      router.push("/diary")
    })
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/diary"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Diary Entry</h1>
          <p className="text-sm text-muted-foreground">Log a personal work note</p>
        </div>
      </div>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's on your mind?" className="rounded-xl text-base font-medium" />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <RichEditor value={content} onChange={setContent} placeholder="Write your notes here…" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="work, meeting, idea (comma-separated)"
                className="rounded-xl"
              />
              {tags && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px] h-5 px-2 rounded-md">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reminder date (optional)</Label>
              <Input
                type="date"
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">Email sent at 7am on selected date</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href="/diary">Cancel</Link>
            </Button>
            <Button className="rounded-xl gap-2" onClick={handleSubmit} disabled={isPending}>
              <CheckCircle className="h-4 w-4" />{isPending ? "Saving…" : "Save Entry"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
