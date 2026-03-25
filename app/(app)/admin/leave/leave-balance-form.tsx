"use client"

import { useTransition, useRef } from "react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { setLeaveBalance } from "@/lib/actions/admin"

interface Props {
    userId: string
    leaveType: string
    year: number
    currentTotal: number
    label: string
}

export function LeaveBalanceForm({ userId, leaveType, year, currentTotal, label }: Props) {
    const [isPending, startTransition] = useTransition()
    const inputRef = useRef<HTMLInputElement>(null)

    function save() {
        const total = Number(inputRef.current?.value ?? currentTotal)
        if (total === currentTotal) return
        const fd = new FormData()
        fd.append("user_id", userId)
        fd.append("leave_type", leaveType)
        fd.append("year", String(year))
        fd.append("total", String(total))
        startTransition(async () => {
            const result = await setLeaveBalance(fd)
            if (result?.error) toast.error(`Failed to save ${label}: ${result.error}`)
            else toast.success(`${label} updated`)
        })
    }

    return (
        <Input
            ref={inputRef}
            type="number"
            defaultValue={currentTotal}
            min={0}
            max={365}
            step={0.5}
            disabled={isPending}
            onBlur={save}
            className="h-9 w-20 rounded-lg text-center font-bold bg-background/50 border-border/60 focus-visible:ring-brand-taupe"
        />
    )
}
