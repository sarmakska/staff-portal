"use client"

import { useEffect, useState, useTransition } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { updateDiaryEntry } from "@/lib/actions/diary"
import { DeleteDiaryButton } from "@/components/shared/delete-diary-button"
import { RichEditor } from "@/components/shared/rich-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, Bell, BellOff, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function DiaryEntryPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [entry, setEntry] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // edit state
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [tags, setTags] = useState("")
  const [reminder, setReminder] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("diary_entries")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error("Entry not found"); router.push("/diary"); return }
        setEntry(data)
        setTitle(data.title ?? "")
        setContent(data.content ?? "")
        setTags(Array.isArray(data.tags) ? data.tags.join(", ") : "")
        if (data.reminder_at) {
          const d = new Date(data.reminder_at)
          setReminder(d.toISOString().slice(0, 10))
        }
        setLoading(false)
      })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    if (!title.trim()) { toast.error("Title is required"); return }
    startTransition(async () => {
      const tagList = tags.split(",").map(t => t.trim()).filter(Boolean)
      const res = await updateDiaryEntry(id, {
        title: title.trim(),
        content,
        tags: tagList,
        reminder_at: reminder ? new Date(reminder + "T07:00:00").toISOString() : null,
      })
      if (res.success) {
        toast.success("Entry updated")
      } else {
        toast.error(res.error || "Failed to update")
      }
    })
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-64 bg-muted rounded-2xl" />
      </div>
    )
  }

  const now = new Date()
  const hasReminder = !!entry.reminder_at
  const reminderDate = hasReminder ? new Date(entry.reminder_at) : null
  const reminderSent = entry.reminder_sent === true
  const reminderPast = reminderDate ? reminderDate <= now : false

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" asChild>
            <Link href="/diary"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Entry</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(entry.created_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <DeleteDiaryButton id={id} />
      </div>

      {/* Reminder status pill */}
      {hasReminder && reminderDate && (
        <div>
          {reminderSent ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 px-3 py-1 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Reminder sent · {reminderDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : reminderPast ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted border border-border px-3 py-1 rounded-full">
              <BellOff className="h-3 w-3" />
              Reminder missed · {reminderDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800 px-3 py-1 rounded-full">
              <Bell className="h-3 w-3" />
              Reminder set · {reminderDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {/* Form */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Title *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Entry title"
            className="rounded-xl text-base font-medium"
          />
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="Write your notes here…"
            printTitle={title}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tags</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, meeting, idea"
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
            <Label>Reminder date</Label>
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
          <Button className="rounded-xl gap-2" onClick={handleSave} disabled={isPending}>
            <CheckCircle className="h-4 w-4" />
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
