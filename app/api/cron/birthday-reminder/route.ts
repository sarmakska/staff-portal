import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendBirthdayReminderEmail, sendBirthdayWishEmail } from '@/lib/email'
import { getEmailFlags } from '@/lib/actions/app-settings'

// Called by GitHub Actions at 8am UK time every day.
// 1. Finds users whose birthday is TOMORROW → sends colleague reminder emails (email_birthday flag)
// 2. Finds users whose birthday is TODAY → sends personal "Happy Birthday" wish (email_birthday_self flag)

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const flags = await getEmailFlags()
    const sendToColleagues = flags.email_birthday
    const sendToSelf = flags.email_birthday_self

    if (!sendToColleagues && !sendToSelf) {
        return NextResponse.json({ success: true, skipped: 'all birthday notifications disabled' })
    }

    const now = new Date()

    // Today (for self-wish)
    const todayMonth = String(now.getMonth() + 1).padStart(2, '0')
    const todayDay = String(now.getDate()).padStart(2, '0')

    // 2 days ahead (for colleague reminder — sent 2 days in advance)
    const twoDaysAhead = new Date(now)
    twoDaysAhead.setDate(twoDaysAhead.getDate() + 2)
    const tomorrowMonth = String(twoDaysAhead.getMonth() + 1).padStart(2, '0')
    const tomorrowDay = String(twoDaysAhead.getDate()).padStart(2, '0')

    // Fetch all active users with a birthday set
    const { data: allUsers, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, full_name, display_name, birthday')
        .eq('is_active', true)
        .not('birthday', 'is', null)

    if (error) {
        console.error('[cron/birthday-reminder] Query error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const users = (allUsers ?? []) as any[]

    // Users whose birthday is TODAY → send self-wish
    const todayBirthdays = users.filter(u => {
        if (!u.birthday) return false
        const parts = (u.birthday as string).split('-')
        return parts[1] === todayMonth && parts[2] === todayDay
    })

    // Users whose birthday is in 2 DAYS → send colleague reminder
    const tomorrowBirthdays = users.filter(u => {
        if (!u.birthday) return false
        const parts = (u.birthday as string).split('-')
        return parts[1] === tomorrowMonth && parts[2] === tomorrowDay
    })

    if (todayBirthdays.length === 0 && tomorrowBirthdays.length === 0) {
        return NextResponse.json({ success: true, sent: 0, message: 'No birthdays today or in 2 days' })
    }

    // For colleague emails: fetch all active users (email required)
    const { data: allActiveUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, full_name, display_name')
        .eq('is_active', true)
        .not('email', 'is', null)

    const recipients = (allActiveUsers ?? []) as any[]

    const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']

    let sent = 0

    // 1. Send "Happy Birthday" wish TO today's birthday people
    if (sendToSelf) {
        for (const birthdayPerson of todayBirthdays) {
            if (!birthdayPerson.email) continue
            const name = birthdayPerson.display_name || birthdayPerson.full_name || 'A colleague'
            const parts = (birthdayPerson.birthday as string).split('-')
            const yearNum = parseInt(parts[0] ?? '0')
            const birthdayDate = yearNum > 1
                ? `${parseInt(parts[2] ?? '0')} ${months[parseInt(parts[1] ?? '0')]} ${parts[0]}`
                : `${parseInt(parts[2] ?? '0')} ${months[parseInt(parts[1] ?? '0')]}`
            try {
                await sendBirthdayWishEmail({ to: birthdayPerson.email, name, birthdayDate })
                sent++
            } catch (err) {
                console.error(`[cron/birthday-reminder] Self-wish failed for ${birthdayPerson.email}:`, err)
            }
        }
    }

    // 2. Notify all OTHER active employees about birthdays in 2 DAYS (2 day advance notice)
    if (sendToColleagues) {
        for (const birthdayPerson of tomorrowBirthdays) {
            const name = birthdayPerson.display_name || birthdayPerson.full_name || 'A colleague'
            const parts = (birthdayPerson.birthday as string).split('-')
            const yearNum = parseInt(parts[0] ?? '0')
            const birthdayDate = yearNum > 1
                ? `${parseInt(parts[2] ?? '0')} ${months[parseInt(parts[1] ?? '0')]} ${parts[0]}`
                : `${parseInt(parts[2] ?? '0')} ${months[parseInt(parts[1] ?? '0')]}`
            for (const recipient of recipients) {
                if (!recipient.email || recipient.id === birthdayPerson.id) continue
                try {
                    await sendBirthdayReminderEmail({
                        to: recipient.email,
                        recipientName: recipient.display_name || recipient.full_name || 'there',
                        birthdayPersonName: name,
                        birthdayDate,
                    })
                    sent++
                } catch (err) {
                    console.error(`[cron/birthday-reminder] Colleague email failed for ${recipient.email}:`, err)
                }
            }
        }
    }

    console.log(`[cron/birthday-reminder] Sent ${sent} emails (today: ${todayBirthdays.length} birthday(s), in 2 days: ${tomorrowBirthdays.length} birthday(s))`)
    return NextResponse.json({ success: true, sent, todayBirthdays: todayBirthdays.length, tomorrowBirthdays: tomorrowBirthdays.length })
}
