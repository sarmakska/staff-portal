"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./auth"

export async function addContact(data: { name: string; email?: string; phone?: string; company?: string; job_title?: string; notes?: string }) {
    const supabase = await createClient()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { error } = await supabase.from("external_contacts").insert({
        added_by: user.id,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        job_title: data.job_title || null,
        notes: data.notes || null,
    })

    if (error) return { success: false, error: error.message }
    revalidatePath("/directory")
    return { success: true }
}

export async function updateContact(id: string, data: { name: string; email?: string; phone?: string; company?: string; job_title?: string; notes?: string }) {
    const supabase = await createClient()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { error } = await supabase.from("external_contacts").update({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        job_title: data.job_title || null,
        notes: data.notes || null,
    }).eq("id", id)

    if (error) return { success: false, error: error.message }
    revalidatePath("/directory")
    return { success: true }
}

export async function deleteContact(id: string) {
    const supabase = await createClient()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const { error } = await supabase.from("external_contacts").delete().eq("id", id)
    if (error) return { success: false, error: error.message }

    revalidatePath("/directory")
    return { success: true }
}
