"use client"
import { useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { updateDepartmentHead } from "@/lib/actions/admin"

export default function DeptHeadSelect({ deptId, currentHeadId, users }: { deptId: string, currentHeadId: string | null, users: { id: string, full_name: string }[] }) {
    const [isPending, startTransition] = useTransition()
    return (
        <Select
            disabled={isPending}
            defaultValue={currentHeadId || "none"}
            onValueChange={(val) => {
                startTransition(async () => {
                    const headId = val === "none" ? null : val
                    const res = await updateDepartmentHead(deptId, headId)
                    if (res?.error) toast.error(res.error)
                    else toast.success("Department head updated")
                })
            }}
        >
            <SelectTrigger className="h-8 w-[160px] text-xs font-medium">
                <SelectValue placeholder="Assign Head" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none" className="text-muted-foreground italic">No head assigned</SelectItem>
                {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
