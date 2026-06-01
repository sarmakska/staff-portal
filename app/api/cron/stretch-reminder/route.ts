export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'

// Runs Mon–Fri at 11am and 3pm UK time via GitHub Actions
// Sends stretch reminder emails to staff who have opted in

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@yourcompany.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'

const STRETCH_TIPS = [
  { title: 'Neck Roll', desc: 'Roll your head gently from side to side — hold 5 seconds each side.' },
  { title: 'Shoulder Shrug', desc: 'Raise both shoulders up to your ears, hold 3 seconds, release. Repeat 5 times.' },
  { title: 'Wrist Stretch', desc: 'Extend your arms and rotate your wrists in circles — 10 each direction.' },
  { title: 'Chest Opener', desc: 'Clasp hands behind your back and gently lift your chest. Hold 15 seconds.' },
  { title: 'Seated Twist', desc: 'Twist gently to the left, hold 15 seconds, then the right.' },
  { title: 'Eye Rest', desc: 'Look away from your screen at something 20 feet away for 20 seconds.' },
]

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!resend) {
    return NextResponse.json({ success: true, skipped: 'RESEND_API_KEY not configured' })
  }

  // Get staff who have stretch_reminder = true (or no pref row = default true)
  const { data: allStaff } = await (supabaseAdmin as any)
    .from('user_profiles')
    .select('id, email, full_name, display_name')
    .eq('is_active', true)

  const staffIds = (allStaff ?? []).map((s: any) => s.id)
  const { data: prefs } = await (supabaseAdmin as any)
    .from('wellness_notification_prefs')
    .select('user_id, stretch_reminder')
    .in('user_id', staffIds)

  const optedOut = new Set<string>()
  for (const p of (prefs ?? [])) {
    if (!p.stretch_reminder) optedOut.add(p.user_id)
  }

  const tip = STRETCH_TIPS[Math.floor(Math.random() * STRETCH_TIPS.length)]

  const batch: { from: string; to: string[]; subject: string; html: string }[] = []

  for (const staff of (allStaff ?? [])) {
    if (optedOut.has(staff.id) || !staff.email) continue

    const name = staff.display_name || staff.full_name || 'there'
    const firstName = name.split(' ')[0]

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Time to Stretch!</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr><td style="background:#111827;border-radius:12px 12px 0 0;padding:20px 28px;">
          <span style="color:#fff;font-size:16px;font-weight:700;">StaffPortal</span><br>
          <span style="color:#9ca3af;font-size:11px;">Wellness Hub</span>
        </td></tr>
        <tr><td style="background:#16a34a;height:3px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
          <p style="margin:0 0 8px;font-size:20px;">🧘 Time for a quick stretch, ${firstName}!</p>
          <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.6;">
            You've been at your desk for a while. A 2-minute break can boost your energy and focus.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:0 0 20px;">
            <p style="margin:0 0 6px;color:#16a34a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Today's stretch</p>
            <p style="margin:0 0 4px;color:#111827;font-size:15px;font-weight:700;">${tip.title}</p>
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${tip.desc}</p>
          </div>
          <p style="margin:20px 0 0;text-align:center;">
            <a href="${APP_URL}/wellness/stretches" style="display:inline-block;padding:10px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
              Full stretch library →
            </a>
          </p>
          <p style="margin:20px 0 0;color:#9ca3af;font-size:11px;text-align:center;">
            You can turn off stretch reminders in <a href="${APP_URL}/wellness/my-journey" style="color:#16a34a;">Wellness → My Journey → Notifications</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    batch.push({ from: FROM_EMAIL, to: [staff.email], subject: `🧘 Time to stretch, ${firstName}!`, html })
  }

  let sent = 0
  if (batch.length > 0) {
    try {
      await resend.batch.send(batch)
      sent = batch.length
    } catch (err) {
      console.error('[cron/stretch-reminder] Batch send failed:', err)
    }
  }

  const date = new Date().toISOString().split('T')[0]
  console.log(`[cron/stretch-reminder] ${date} — sent ${sent}`)
  return NextResponse.json({ success: true, sent, date })
}
