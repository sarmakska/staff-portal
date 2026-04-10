import { getStaffForKiosk } from "@/lib/actions/visitors"
import KioskClient from "./kiosk-client"

// Force dynamic so every page refresh hits the DB, not a stale cached render
export const dynamic = 'force-dynamic'

export default async function KioskPage() {
  const initialStaff = await getStaffForKiosk()
  return <KioskClient initialStaff={initialStaff} />
}
