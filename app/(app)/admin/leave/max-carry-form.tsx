"use client"

import { useTransition, useRef } from "react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { setMaxCarryForward } from "@/lib/actions/admin"

interface Props {
    userId: string
    currentMax: number
}

export function MaxCarryForm({ userId, currentMax }: Props) {
    const [isPending, startTransition] = useTransition()
    const inputRef = useRef<HTMLInputElement>(null)

    function save() {
        const days = Number(inputRef.current?.value ?? currentMax)
        if (days === currentMax) return
        startTransition(async () => {
            const result = await setMaxCarryForward(userId, days)
            if (result?.error) toast.error(`Failed: ${result.error}`)
            else toast.success("Max carry-forward updated")
        })
    }

    return (
        <Input
            ref={inputRef}
            type="number"
            defaultValue={currentMax}
            min={0}
            max={30}
            disabled={isPending}
            onBlur={save}
            className="h-9 w-20 rounded-lg text-center font-bold bg-background/50 border-border/60 focus-visible:ring-brand-taupe"
        />
    )
}
