"use server"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { EMAIL_NOTIFICATION_KEYS } from "@/lib/notification-settings"

// ── Storage-backed settings (no DB table required) ────────────
// Settings are stored as a JSON file in the private 'system-config' bucket.
// The service role key creates the bucket and file automatically on first save.

const BUCKET = "system-config"
const FILE = "notification-settings.json"

const DEFAULTS = Object.fromEntries(EMAIL_NOTIFICATION_KEYS.map(k => [k, true])) as Record<string, boolean>

async function ensureBucket() {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: false })
    if (error && !error.message.includes("already exists")) {
        console.warn("[app-settings] Could not create bucket:", error.message)
    }
}

async function readSettings(): Promise<Record<string, boolean>> {
    try {
        const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(FILE)
        if (error || !data) return { ...DEFAULTS }
        const text = await data.text()
        const parsed = JSON.parse(text)
        return { ...DEFAULTS, ...parsed }
    } catch {
        return { ...DEFAULTS }
    }
}

async function writeSettings(settings: Record<string, boolean>): Promise<{ success: boolean; error?: string }> {
    await ensureBucket()
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" })
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(FILE, blob, {
        upsert: true,
        contentType: "application/json",
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function getEmailFlags(): Promise<Record<string, boolean>> {
    try {
        return await readSettings()
    } catch {
        return { ...DEFAULTS }
    }
}

export async function getNotificationSettings(): Promise<{ settings: Record<string, boolean>; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { settings: { ...DEFAULTS }, error: "Unauthorized" }

    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes("admin")) return { settings: { ...DEFAULTS }, error: "Admin only" }

    return { settings: await readSettings() }
}

export async function updateNotificationSetting(key: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "Unauthorized" }

    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes("admin") && !roles.includes("director")) return { success: false, error: "Admin only" }

    if (!(EMAIL_NOTIFICATION_KEYS as readonly string[]).includes(key)) {
        return { success: false, error: "Invalid key" }
    }

    const current = await readSettings()
    current[key] = enabled
    const result = await writeSettings(current)
    if (!result.success) return result

    revalidatePath("/admin/notifications")
    return { success: true }
}
