"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Props {
  users: { id: string; name: string }[]
  selectedId: string
}

export function UserSelector({ users, selectedId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(id: string) {
    // Preserve from/to params so date range doesn't reset when switching employee
    const params = new URLSearchParams(searchParams.toString())
    params.set("user", id)
    router.push(`/timesheets?${params.toString()}`)
  }

  return (
    <Select value={selectedId} onValueChange={handleChange}>
      <SelectTrigger className="w-56 rounded-xl">
        <SelectValue placeholder="Select employee" />
      </SelectTrigger>
      <SelectContent>
        {users.map(u => (
          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
