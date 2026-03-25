"use client"

import { useTransition, useRef } from "react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { setLeaveUsed } from "@/lib/actions/admin"

interface Props {
    userId: string
    leaveType: string
    year: number
    currentUsed: number
}

export function UsedBalanceForm({ userId, leaveType, year, currentUsed }: Props) {
    const [isPending, startTransition] = useTransition()
    const inputRef = useRef<HTMLInputElement>(null)

    function save() {
        const used = Number(inputRef.current?.value ?? currentUsed)
        if (used === currentUsed) return
        const fd = new FormData()
        fd.append("user_id", userId)
        fd.append("leave_type", leaveType)
        fd.append("year", String(year))
        fd.append("used", String(used))
        startTransition(async () => {
            const result = await setLeaveUsed(fd)
            if (result?.error) toast.error(`Failed to save: ${result.error}`)
            else toast.success("Used days updated")
        })
    }

    return (
        <Input
            ref={inputRef}
            type="number"
            defaultValue={currentUsed}
            min={0}
            max={365}
            step={0.5}
            disabled={isPending}
            onBlur={save}
            className="h-9 w-20 rounded-lg text-center font-bold bg-background/50 border-border/60 focus-visible:ring-orange-400"
        />
    )
}
