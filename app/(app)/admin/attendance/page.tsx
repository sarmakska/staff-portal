import { getCurrentUser } from "@/lib/actions/auth"
import { redirect } from "next/navigation"
import { getLiveStaffAttendance, adminGetAllStaffWfh } from "@/lib/actions/attendance"
import { AdminAttendanceClient } from "./attendance-client"
import { WfhManagementClient } from "./wfh-management-client"

export const metadata = {
    title: "Live Attendance | StaffPortal Admin"
}

export default async function AdminAttendancePage() {
    const user = await getCurrentUser()

    if (!user || (!user.isAdmin && !user.isReception)) {
        redirect("/unauthorized")
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const [attendanceData, wfhData] = await Promise.all([
        getLiveStaffAttendance(),
        adminGetAllStaffWfh(todayStr),
    ])

    return (
        <div className="flex-1 space-y-10">
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Attendance</h1>
                </div>
                <p className="text-muted-foreground">
                    Real-time view of all staff members today. Use this dashboard to correct any clock-in or clock-out errors.
                </p>
            </div>

            <AdminAttendanceClient initialData={attendanceData} />

            <WfhManagementClient initialDate={todayStr} initialData={wfhData} />
        </div>
    )
}
