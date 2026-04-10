'use client'

import { useTransition } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { deleteCalendarEvent } from '@/lib/actions/calendar'
import { deleteWfhByEventId } from '@/lib/actions/attendance'

interface Props {
    id: string
    title: string
    className: string
    canDelete: boolean
    deleteType?: 'calendar' | 'wfh'
}

export function CalendarEventItem({ id, title, className, canDelete, deleteType = 'calendar' }: Props) {
    const [isPending, startTransition] = useTransition()

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm(`Are you sure you want to delete "${title}"?`)) return

        startTransition(async () => {
            const res = deleteType === 'wfh'
                ? await deleteWfhByEventId(id)
                : await deleteCalendarEvent(id)
            if (res.success) {
                toast.success("Deleted")
            } else {
                toast.error(res.error || "Failed to delete")
            }
        })
    }

    return (
        <div title={title} className={`group relative flex items-center justify-between ${className}`}>
            <span className="truncate">{title}</span>
            {canDelete && (
                <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="ml-1 rounded-sm opacity-0 hover:bg-black/10 transition-opacity group-hover:opacity-100 dark:hover:bg-white/10"
                    title="Delete Event"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    )
}
