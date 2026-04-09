import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { getNotificationSettings } from "@/lib/actions/app-settings"
import { adminGetStaffWellnessPrefs } from "@/lib/actions/wellness"
import NotificationsClient from "./notifications-client"

export default async function NotificationsPage() {
    const authCtx = await getCurrentUser()
    if (!authCtx?.isAdmin && !authCtx?.isDirector) redirect("/")

    const [{ settings }, staffWellnessPrefs] = await Promise.all([
        getNotificationSettings(),
        adminGetStaffWellnessPrefs(),
    ])

    const envEmails = {
        wfhNotify: process.env.WFH_NOTIFY_EMAIL ?? 'staff@yourcompany.com',
        accountsNotify: process.env.ACCOUNTS_NOTIFY_EMAIL ?? 'accounts@yourcompany.com',
        receptionNotify: process.env.RECEPTION_NOTIFY_EMAIL ?? 'reception@yourcompany.com',
    }

    return <NotificationsClient settings={settings} envEmails={envEmails} staffWellnessPrefs={staffWellnessPrefs} />
}
