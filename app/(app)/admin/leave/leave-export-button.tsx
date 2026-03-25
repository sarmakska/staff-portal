"use client"

import { useState } from "react"
import { FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { exportLeaveAllowances } from "@/lib/actions/leave-allowances-export"

export function LeaveExportButton() {
    const [loading, setLoading] = useState(false)

    async function handleExport() {
        setLoading(true)
        try {
            const result = await exportLeaveAllowances()
            if (result.error || !result.base64 || !result.filename) {
                toast.error(result.error ?? "Export failed")
                return
            }
            const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))
            const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = result.filename
            a.click()
            URL.revokeObjectURL(url)
            toast.success("Excel file downloaded")
        } catch {
            toast.error("Export failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading}
            className="gap-2"
        >
            <FileSpreadsheet className="h-4 w-4" />
            {loading ? "Exporting..." : "Export Excel"}
        </Button>
    )
}
