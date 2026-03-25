import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function AdminIndexPage() {
    const authCtx = await getCurrentUser()
    if (!authCtx?.isAdmin && !authCtx?.isDirector) redirect("/")
    if (authCtx.isAdmin) redirect("/admin/users")
    redirect("/admin/leave")
}
