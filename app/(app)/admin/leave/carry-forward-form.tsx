"use client"

import { useTransition, useRef } from "react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { setCarryForward } from "@/lib/actions/admin"

interface Props {
    userId: string
    currentCarry: number
    isAuto?: boolean
}

export function CarryForwardForm({ userId, currentCarry, isAuto }: Props) {
    const [isPending, startTransition] = useTransition()
    const inputRef = useRef<HTMLInputElement>(null)

    function save() {
        const carry = Number(inputRef.current?.value ?? currentCarry)
        if (carry === currentCarry) return
        startTransition(async () => {
            const result = await setCarryForward(userId, carry)
            if (result?.error) toast.error(`Failed: ${result.error}`)
            else toast.success("Carry forward updated")
        })
    }

    if (isAuto) {
        return (
            <div className="flex items-center justify-center mt-1">
                <span className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-bold bg-muted/50 text-foreground border border-border/40">
                    {currentCarry}
                    <span className="text-[9px] text-muted-foreground font-normal">auto</span>
                </span>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center mt-1">
            <Input
                ref={inputRef}
                type="number"
                defaultValue={currentCarry}
                min={0}
                max={365}
                step={0.5}
                disabled={isPending}
                onBlur={save}
                className="h-7 w-16 rounded-md text-center text-xs font-bold"
            />
        </div>
    )
}
