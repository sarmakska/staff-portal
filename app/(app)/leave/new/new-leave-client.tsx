"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, ArrowRight, CheckCircle, Upload } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { submitLeaveRequest } from "@/lib/actions/leave"

const STEPS = ["Type & Dates", "Details", "Review"]

interface Props {
    permittedLeaveTypes: string[]
}

export default function NewLeaveClient({ permittedLeaveTypes }: Props) {
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [leaveType, setLeaveType] = useState("annual")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [dayType, setDayType] = useState("full")
    const [reason, setReason] = useState("")
    const [isPending, startTransition] = useTransition()

    const canProceed = () => {
        if (step === 0) return leaveType && startDate && endDate
        if (step === 1) return reason.trim().length > 0
        return true
    }

    // Normalize hyphens to underscores for DB enum (half-am → half_am)
    const normaliseDayType = (dt: string) => dt.replace("-", "_") as "full" | "half_am" | "half_pm"

    const handleSubmit = () => {
        startTransition(async () => {
            const result = await submitLeaveRequest({
                leaveType,
                startDate,
                endDate,
                dayType: normaliseDayType(dayType),
                reason,
            })
            if (result.success) {
                toast.success("Leave request submitted!")
                router.push("/leave")
            } else {
                toast.error(result.error ?? "Failed to submit leave request")
            }
        })
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="rounded-xl" asChild>
                    <Link href="/leave"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">New Leave Request</h1>
                    <p className="text-sm text-muted-foreground">Submit a new leave request for approval</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2">
                {STEPS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                            {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
                        </div>
                        <span className={`hidden text-sm font-medium sm:inline ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                        {i < STEPS.length - 1 && <div className={`mx-1 h-px w-8 sm:w-12 ${i < step ? "bg-primary" : "bg-border"}`} />}
                    </div>
                ))}
            </div>

            <Card className="rounded-2xl border-border shadow-sm max-w-2xl">
                <CardContent className="p-6">
                    {step === 0 && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label>Leave Type</Label>
                                <Select value={leaveType} onValueChange={setLeaveType}>
                                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {permittedLeaveTypes.includes("annual") && <SelectItem value="annual">Annual Leave</SelectItem>}
                                        {permittedLeaveTypes.includes("sick") && <SelectItem value="sick">Sick Leave</SelectItem>}
                                        {permittedLeaveTypes.includes("maternity") && <SelectItem value="maternity">Maternity Leave</SelectItem>}
                                        {permittedLeaveTypes.includes("paternity") && <SelectItem value="paternity">Paternity Leave</SelectItem>}
                                        {permittedLeaveTypes.includes("unpaid") && <SelectItem value="unpaid">Unpaid Leave</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }} className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl" min={startDate} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Day Type</Label>
                                <RadioGroup value={dayType} onValueChange={setDayType} className="flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="full" id="full" />
                                        <Label htmlFor="full" className="text-sm cursor-pointer">Full Day</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="half-am" id="half-am" />
                                        <Label htmlFor="half-am" className="text-sm cursor-pointer">Morning Only</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="half-pm" id="half-pm" />
                                        <Label htmlFor="half-pm" className="text-sm cursor-pointer">Afternoon Only</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label>Reason</Label>
                                <Textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Briefly explain the reason for your leave..."
                                    className="rounded-xl min-h-[100px]"
                                />
                                {reason.trim().length === 0 && (
                                    <p className="text-xs text-destructive">Reason is required</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Attachment (optional)</Label>
                                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="text-center space-y-2">
                                        <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                                        <p className="text-sm text-muted-foreground">Drag a file here or click to browse</p>
                                        <p className="text-xs text-muted-foreground">PDF, JPG, PNG up to 5MB</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5">
                            <p className="text-sm text-muted-foreground">Please review your leave request before submitting.</p>
                            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Type</span>
                                    <span className="font-medium text-foreground capitalize">{leaveType} Leave</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Start</span>
                                    <span className="font-medium text-foreground">{startDate ? new Date(startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">End</span>
                                    <span className="font-medium text-foreground">{endDate ? new Date(endDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Day Type</span>
                                    <span className="font-medium text-foreground capitalize">{dayType === "full" ? "Full Day" : dayType === "half-am" ? "Morning" : "Afternoon"}</span>
                                </div>
                                <div className="border-t border-border pt-3">
                                    <p className="text-xs text-muted-foreground mb-1">Reason</p>
                                    <p className="text-sm text-foreground">{reason}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between mt-8">
                        <Button
                            variant="outline"
                            className="rounded-xl gap-2"
                            onClick={() => setStep(step - 1)}
                            disabled={step === 0}
                        >
                            <ArrowLeft className="h-4 w-4" />Back
                        </Button>
                        {step < 2 ? (
                            <Button
                                className="rounded-xl gap-2"
                                onClick={() => setStep(step + 1)}
                                disabled={!canProceed()}
                            >
                                Next<ArrowRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button className="rounded-xl gap-2" onClick={handleSubmit} disabled={isPending}>
                                <CheckCircle className="h-4 w-4" />{isPending ? "Submitting…" : "Submit Request"}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
