"use client"
import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { updateTemplate } from "@/lib/actions/admin"

type Template = {
    id: string
    name: string
    subject: string
    html_body: string
    category: string
    variables: string[]
}

export default function TemplatesClient({ templates }: { templates: Template[] }) {
    const [isPending, startTransition] = useTransition()
    const [editItem, setEditItem] = useState<Template | null>(null)
    const [formData, setFormData] = useState({ subject: "", html_body: "" })

    const handleOpenEdit = (t: Template) => {
        setFormData({ subject: t.subject, html_body: t.html_body })
        setEditItem(t)
    }

    const handleSubmit = () => {
        if (!editItem) return
        startTransition(async () => {
            const res = await updateTemplate(editItem.id, formData)
            if (res.error) toast.error(res.error)
            else {
                toast.success("Template updated")
                setEditItem(null)
            }
        })
    }

    return (
        <div className="space-y-3">
            {templates.map((t) => (
                <Card key={t.id} className="rounded-2xl border-border shadow-sm hover:shadow-md transition-shadow bg-card/40 backdrop-blur-sm group cursor-pointer" onClick={() => handleOpenEdit(t)}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
                            <div className="space-y-1 w-full">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                                    <Badge variant="secondary" className="text-[10px] rounded-md font-mono shrink-0">{t.category}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <Badge variant="outline" className="rounded-full text-[10px] text-green-600 border-green-600/30">Active</Badge>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Template Editor Modal */}
            <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Template: {editItem?.name}</DialogTitle>
                        <DialogDescription className="text-xs font-mono">
                            Available variables: {editItem?.variables?.join(", ") || "None"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 overflow-y-auto py-2 pr-1">
                        <div className="space-y-2">
                            <label className="text-xs font-medium">Email Subject</label>
                            <Input
                                value={formData.subject}
                                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                className="font-medium"
                            />
                        </div>
                        <div className="space-y-2 flex-1 flex flex-col">
                            <label className="text-xs font-medium">HTML Body</label>
                            <textarea
                                className="w-full flex-1 min-h-[300px] p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none text-sm font-mono leading-relaxed"
                                value={formData.html_body}
                                onChange={e => setFormData({ ...formData, html_body: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4 pt-4 border-t border-border">
                        <Button variant="outline" onClick={() => setEditItem(null)} disabled={isPending}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isPending}>Save Template</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
