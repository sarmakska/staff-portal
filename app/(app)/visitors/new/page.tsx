import NewVisitorForm from "./new-visitor-form"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function NewVisitorBookingPage() {
  await getCurrentUser()
  return <NewVisitorForm />
}
