import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendDiaryReminderEmail } from '@/lib/email'

// Vercel Cron: runs every hour — schedule set in vercel.json
// Finds diary entries with reminder_at <= now and reminder_sent = false,
// sends the user an email, then marks reminder_sent = true.

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date().toISOString()

    // Fetch all due, unsent reminders
    const { data: entries, error } = await supabaseAdmin
        .from('diary_entries')
        .select('id, user_id, title, content, tags, reminder_at')
        .lte('reminder_at', now)
        .eq('reminder_sent', false)

    if (error) {
        console.error('[cron/diary-reminders] Query error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!entries || entries.length === 0) {
        return NextResponse.json({ success: true, sent: 0 })
    }

    // Fetch user profiles (email + name) for all affected users
    const userIds = [...new Set(entries.map((e: any) => e.user_id))]
    const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, full_name, display_name')
        .in('id', userIds)

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    let sent = 0
    for (const entry of entries as any[]) {
        const profile = profileMap.get(entry.user_id)
        if (!profile?.email) continue

        const name = profile.display_name || profile.full_name || 'there'
        const reminderAt = new Date(entry.reminder_at).toLocaleString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
        })

        try {
            await sendDiaryReminderEmail({
                to: profile.email,
                name,
                title: entry.title,
                content: entry.content ?? null,
                tags: entry.tags ?? [],
                reminderAt,
            })

            // Mark as sent
            await supabaseAdmin
                .from('diary_entries')
                .update({ reminder_sent: true } as any)
                .eq('id', entry.id)

            sent++
        } catch (err) {
            console.error(`[cron/diary-reminders] Failed for entry ${entry.id}:`, err)
        }
    }

    console.log(`[cron/diary-reminders] Sent ${sent}/${entries.length} reminders`)
    return NextResponse.json({ success: true, sent, total: entries.length })
}
