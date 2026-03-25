'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { deleteDiaryEntry } from '@/lib/actions/diary'

export function DeleteDiaryButton({ id }: { id: string }) {
    const [isPending, startTransition] = useTransition()

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-1"
            disabled={isPending}
            onClick={() => {
                if (!confirm("Are you sure you want to delete this diary entry?")) return

                startTransition(async () => {
                    const res = await deleteDiaryEntry(id)
                    if (res.success) {
                        toast.success("Entry deleted")
                    } else {
                        toast.error(res.error || "Failed to delete entry")
                    }
                })
            }}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    )
}
