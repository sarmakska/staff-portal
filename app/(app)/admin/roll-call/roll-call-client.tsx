"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert, Printer, Users, Contact } from "lucide-react"

interface StaffOnSite {
    id: string
    full_name: string
    department: string
    phone: string
    extension: string
    clock_in: string
}

interface VisitorOnSite {
    id: string
    name: string
    company: string
    host_name: string
    checked_in_at: string
}

interface Props {
    staff: StaffOnSite[]
    visitors: VisitorOnSite[]
    generatedAt: string
}

export default function RollCallClient({ staff, visitors, generatedAt }: Props) {
    const handlePrint = () => {
        window.print()
    }

    const fmtTime = (iso: string | null) => {
        if (!iso) return "—"
        return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    }

    const fmtDate = (iso: string) => {
        return new Date(iso).toLocaleString("en-GB", {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const totalPersonnel = staff.length + visitors.length

    return (
        <div className="space-y-6 p-4 md:p-8 max-w-5xl mx-auto print:p-0 print:m-0 print:w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3 text-destructive">
                        <ShieldAlert className="h-8 w-8" />
                        Fire Evacuation Roll Call
                    </h1>
                    <p className="text-base font-medium text-muted-foreground mt-1">Real-time manifest of all personnel currently checked into the building.</p>
                </div>

                <Button onClick={handlePrint} className="rounded-xl gap-2 min-w-[140px] shadow-sm">
                    <Printer className="h-4 w-4" /> Print Roll Call
                </Button>
            </div>

            <div className="hidden print:block mb-8 border-b-2 border-black pb-4">
                <h1 className="text-4xl font-bold uppercase tracking-wider mb-2">Evacuation Roll Call</h1>
                <div className="flex justify-between font-mono text-sm">
                    <p><strong>Generated:</strong> {fmtDate(generatedAt)}</p>
                    <p><strong>Total Personnel:</strong> {totalPersonnel}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:block">

                {/* STAFF LIST */}
                <Card className="rounded-3xl border border-border/60 shadow-sm print:rounded-none print:shadow-none print:border-none print:mb-8">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 print:p-0 print:border-b border-black">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Users className="h-5 w-5 text-brand-taupe print:hidden" />
                            Staff Members
                        </CardTitle>
                        <Badge variant="secondary" className="bg-brand-taupe/10 text-brand-taupe hover:bg-brand-taupe/20 print:bg-transparent print:text-black print:border-none print:p-0 print:text-lg">
                            {staff.length} In Building
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-0 print:pt-4">
                        {staff.length === 0 ? (
                            <p className="text-muted-foreground text-sm p-6 text-center">No staff members currently checked in.</p>
                        ) : (
                            <div className="divide-y divide-border/40 print:divide-black">
                                {staff.sort((a, b) => a.full_name.localeCompare(b.full_name)).map(s => (
                                    <div key={s.id} className="p-4 flex flex-col gap-1 print:py-2">
                                        <div className="flex justify-between items-start">
                                            <span className="font-semibold text-foreground print:text-black">{s.full_name}</span>
                                            <span className="text-xs text-muted-foreground print:text-black">In: {fmtTime(s.clock_in)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground print:text-black/80">
                                            <span>{s.department}</span>
                                            {s.phone && <span>• Phone: {s.phone}</span>}
                                            {s.extension && <span>• Ext: {s.extension}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* VISITOR LIST */}
                <Card className="rounded-3xl border border-border/60 shadow-sm print:rounded-none print:shadow-none print:border-none">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 print:p-0 print:border-b border-black">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Contact className="h-5 w-5 text-green-600 print:hidden" />
                            Visitors
                        </CardTitle>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 print:bg-transparent print:text-black print:border-none print:p-0 print:text-lg">
                            {visitors.length} In Building
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-0 print:pt-4">
                        {visitors.length === 0 ? (
                            <p className="text-muted-foreground text-sm p-6 text-center">No visitors currently onsite.</p>
                        ) : (
                            <div className="divide-y divide-border/40 print:divide-black">
                                {visitors.sort((a, b) => a.name.localeCompare(b.name)).map(v => (
                                    <div key={v.id} className="p-4 flex flex-col gap-1 print:py-2">
                                        <div className="flex justify-between items-start">
                                            <span className="font-semibold text-foreground print:text-black">{v.name}</span>
                                            <span className="text-xs text-muted-foreground print:text-black">In: {fmtTime(v.checked_in_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground print:text-black/80">
                                            {v.company && <span>{v.company}</span>}
                                            <span>Host: {v.host_name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    )
}
