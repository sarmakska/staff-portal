import { supabaseAdmin } from '@/lib/supabase/admin'

export async function getChatContext(userId: string): Promise<string> {
    const today = new Date().toISOString().split('T')[0]
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().split('T')[0]
    const nextWeekStart = new Date(weekStart)
    nextWeekStart.setDate(nextWeekStart.getDate() + 7)
    const nextWeekStartStr = nextWeekStart.toISOString().split('T')[0]
    const nextWeekEnd = new Date(nextWeekStart)
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6)
    const nextWeekEndStr = nextWeekEnd.toISOString().split('T')[0]

    const currentYear = new Date().getFullYear()
    const [
        { data: profile },
        { data: attendance },
        { data: weekAttendance },
        { data: leaveBalances },
        { data: pendingLeave },
        { data: schedule },
        { data: dept },
        { data: approvers },
        { data: lastYearAnnual },
        { data: allAttendance },
        { data: allWfh },
        { data: allLeaveToday },
        { data: allStaff },
        { data: carryProfile },
        { data: teamLeaveThisWeek },
        { data: teamLeaveNextWeek },
        { data: allBirthdays },
        { data: recentExpenses },
        { data: activePolls },
        { data: pollVotes },
        { data: recentAnnouncements },
    ] = await Promise.all([
        supabaseAdmin.from('user_profiles').select('full_name, display_name, email, job_title, department_id, desk_extension, joined_at, created_at, birthday, phone').eq('id', userId).single(),
        supabaseAdmin.from('attendance').select('clock_in, clock_out, work_date, running_late').eq('user_id', userId).eq('work_date', today).maybeSingle(),
        supabaseAdmin.from('attendance').select('clock_in, clock_out, work_date').eq('user_id', userId).gte('work_date', weekStartStr).lte('work_date', today).order('work_date'),
        supabaseAdmin.from('leave_balances').select('leave_type, total, used, pending, carried_forward').eq('user_id', userId).eq('year', new Date().getFullYear()),
        (supabaseAdmin as any).from('leave_requests').select('leave_type, start_date, end_date, status, days_count').eq('user_id', userId).in('status', ['pending', 'approved']).gte('end_date', today).order('start_date').limit(5),
        supabaseAdmin.from('work_schedules').select('work_days, daily_hours, hours_by_day').eq('user_id', userId).maybeSingle(),
        supabaseAdmin.from('departments').select('id, name'),
        (supabaseAdmin as any).from('user_approvers').select('priority, approver:user_profiles!user_approvers_approver_id_fkey(full_name)').eq('user_id', userId).order('priority'),
        supabaseAdmin.from('leave_balances').select('total, used, pending').eq('user_id', userId).eq('leave_type', 'annual').eq('year', currentYear - 1).maybeSingle(),
        // Office presence — who's in/wfh/on leave today
        supabaseAdmin.from('attendance').select('user_id, clock_in, clock_out, running_late').eq('work_date', today),
        (supabaseAdmin as any).from('wfh_records').select('user_id').eq('wfh_date', today),
        (supabaseAdmin as any).from('leave_requests').select('user_id').eq('status', 'approved').lte('start_date', today).gte('end_date', today),
        supabaseAdmin.from('user_profiles').select('id, full_name, display_name').eq('is_active', true),
        (supabaseAdmin as any).from('user_profiles').select('max_carry_forward, carry_forward_days').eq('id', userId).single(),
        // Team leave this week
        (supabaseAdmin as any).from('leave_requests').select('user_id, leave_type, start_date, end_date, days_count').eq('status', 'approved').lte('start_date', weekEndStr).gte('end_date', weekStartStr),
        // Team leave next week
        (supabaseAdmin as any).from('leave_requests').select('user_id, leave_type, start_date, end_date, days_count').eq('status', 'approved').lte('start_date', nextWeekEndStr).gte('end_date', nextWeekStartStr),
        // All staff birthdays (for next 7 days)
        supabaseAdmin.from('user_profiles').select('id, full_name, display_name, birthday').eq('is_active', true).not('birthday', 'is', null),
        // Recent expenses (this user's last 5)
        (supabaseAdmin as any).from('expenses').select('amount, currency, merchant, category_id, status, expense_date, description').eq('user_id', userId).order('expense_date', { ascending: false }).limit(5),
        // Active polls
        (supabaseAdmin as any).from('polls').select('id, question, options, deadline, created_by_name').eq('is_archived', false).gte('deadline', today).order('created_at', { ascending: false }),
        // Poll votes
        (supabaseAdmin as any).from('poll_votes').select('poll_id, option_index'),
        // Recent announcements
        (supabaseAdmin as any).from('announcements').select('subject, sent_by_name, sent_at, category').order('sent_at', { ascending: false }).limit(3),
    ])

    const name = (profile as any)?.display_name || (profile as any)?.full_name || 'User'
    const firstName = name.split(' ')[0]
    const deptName = (dept ?? []).find((d: any) => d.id === (profile as any)?.department_id)?.name ?? 'Not set'
    const joinedAt = (profile as any)?.joined_at ?? (profile as any)?.created_at?.split('T')[0] ?? 'Unknown'

    // Attendance today
    let attendanceToday = 'Not clocked in'
    if (attendance) {
        const a = attendance as any
        const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
        if (a.clock_in && !a.clock_out) attendanceToday = `Clocked in at ${fmtTime(a.clock_in)}`
        else if (a.clock_in && a.clock_out) attendanceToday = `Clocked in ${fmtTime(a.clock_in)} — out ${fmtTime(a.clock_out)}`
        else if (a.running_late) attendanceToday = 'Running late (logged)'
    }

    // Week hours
    let weekHours = 0
    const weekDetails: string[] = []
    for (const row of (weekAttendance ?? []) as any[]) {
        if (row.clock_in && row.clock_out) {
            const hrs = (new Date(row.clock_out).getTime() - new Date(row.clock_in).getTime()) / 3600000
            weekHours += hrs
            const day = new Date(row.work_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
            weekDetails.push(`${day}: ${hrs.toFixed(1)}h`)
        }
    }

    // Compute carry forward for annual leave (same logic as dashboard)
    const maxCarry = (carryProfile as any)?.max_carry_forward ?? 5
    let annualCarry = 0
    if (lastYearAnnual) {
        const rem = Math.max(0, Number((lastYearAnnual as any).total) - Number((lastYearAnnual as any).used) - Number((lastYearAnnual as any).pending))
        annualCarry = Math.min(rem, maxCarry)
    } else {
        annualCarry = (carryProfile as any)?.carry_forward_days ?? 0
    }

    // Leave balances
    const leaveLines = (leaveBalances ?? []).map((lb: any) => {
        const cf = lb.leave_type === 'annual' ? annualCarry : Number(lb.carried_forward ?? 0)
        const effectiveTotal = Number(lb.total) + cf
        const remaining = Math.max(0, effectiveTotal - lb.used - lb.pending)
        return `${lb.leave_type}: ${remaining} days remaining (${lb.used} used, ${effectiveTotal} total${cf > 0 ? `, ${cf} carried forward` : ''})`
    })

    // Pending/upcoming leave
    const leaveLines2 = (pendingLeave ?? []).map((lr: any) => {
        return `${lr.leave_type} leave: ${lr.start_date} to ${lr.end_date} (${lr.status}, ${lr.days_count} days)`
    })

    // Work schedule
    const workDays = (schedule as any)?.work_days ?? ['mon', 'tue', 'wed', 'thu', 'fri']
    const dailyHours = (schedule as any)?.daily_hours ?? 7.5
    const weeklyTarget = workDays.length * dailyHours

    // Approvers
    const approverNames = (approvers ?? []).map((a: any) => `${a.priority}. ${a.approver?.full_name ?? 'Unknown'}`).join(', ')

    // ── Staff name lookup ──────────────────────────────────────────────────
    const staffMap = new Map<string, string>()
    for (const s of (allStaff ?? []) as any[]) {
        staffMap.set(s.id, s.display_name || s.full_name || 'Unknown')
    }
    const staffName = (uid: string) => staffMap.get(uid) ?? 'Unknown'

    // ── Team leave this week ───────────────────────────────────────────────
    const thisWeekLeaveLines = (teamLeaveThisWeek ?? [])
        .filter((lr: any) => lr.user_id !== userId)
        .map((lr: any) => `${staffName(lr.user_id)}: ${lr.leave_type} leave (${lr.start_date} to ${lr.end_date})`)

    // ── Team leave next week ───────────────────────────────────────────────
    const nextWeekLeaveLines = (teamLeaveNextWeek ?? [])
        .filter((lr: any) => lr.user_id !== userId)
        .map((lr: any) => `${staffName(lr.user_id)}: ${lr.leave_type} leave (${lr.start_date} to ${lr.end_date})`)

    // ── Upcoming birthdays (next 7 days, excluding self) ──────────────────
    const upcomingBirthdays: string[] = []
    const now = new Date()
    for (const s of (allBirthdays ?? []) as any[]) {
        if (s.id === userId || !s.birthday) continue
        const parts = (s.birthday as string).split('-')
        const bMonth = parseInt(parts[1])
        const bDay = parseInt(parts[2])
        for (let i = 0; i <= 7; i++) {
            const check = new Date(now)
            check.setDate(check.getDate() + i)
            if (check.getMonth() + 1 === bMonth && check.getDate() === bDay) {
                const label = i === 0 ? 'TODAY' : i === 1 ? 'tomorrow' : `in ${i} days`
                const bName = s.display_name || s.full_name
                upcomingBirthdays.push(`${bName}: birthday ${label} (${bMonth}/${bDay})`)
                break
            }
        }
    }

    // ── Recent expenses ────────────────────────────────────────────────────
    const expenseLines = (recentExpenses ?? []).map((e: any) => {
        const amt = `${e.currency ?? 'GBP'} ${Number(e.amount).toFixed(2)}`
        return `${e.expense_date}: ${amt} at ${e.merchant ?? 'Unknown'} — ${e.status}`
    })

    // ── Active polls ───────────────────────────────────────────────────────
    const pollLines = (activePolls ?? []).map((p: any) => {
        const votes = (pollVotes ?? []).filter((v: any) => v.poll_id === p.id)
        const totalVotes = votes.length
        const optionBreakdown = (p.options as string[]).map((opt: string, i: number) => {
            const count = votes.filter((v: any) => v.option_index === i).length
            return `"${opt}" — ${count} vote${count !== 1 ? 's' : ''}`
        }).join(', ')
        const deadline = new Date(p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        return `"${p.question}" by ${p.created_by_name} (closes ${deadline}, ${totalVotes} total votes): ${optionBreakdown}`
    })

    // ── Recent announcements ───────────────────────────────────────────────
    const announcementLines = (recentAnnouncements ?? []).map((a: any) => {
        const sent = new Date(a.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        return `"${a.subject}" by ${a.sent_by_name} on ${sent}${a.category ? ` [${a.category}]` : ''}`
    })

    // ── Office today ───────────────────────────────────────────────────────
    const officeTodayLines = (() => {
        const clockedInIds = new Set<string>()
        const clockedOutIds = new Set<string>()
        const lateIds = new Set<string>()
        for (const a of (allAttendance ?? []) as any[]) {
            if (a.running_late && !a.clock_in) lateIds.add(a.user_id)
            else if (a.clock_in && !a.clock_out) clockedInIds.add(a.user_id)
            else if (a.clock_in && a.clock_out) clockedOutIds.add(a.user_id)
        }
        const wfhIds = new Set<string>((allWfh ?? []).map((w: any) => w.user_id))
        const leaveIds = new Set<string>((allLeaveToday ?? []).map((l: any) => l.user_id))
        const lines: string[] = []
        for (const [id, sName] of staffMap) {
            if (clockedInIds.has(id)) lines.push(`${sName}: In Office`)
            else if (clockedOutIds.has(id)) lines.push(`${sName}: Left Office`)
            else if (wfhIds.has(id)) lines.push(`${sName}: Working from Home`)
            else if (leaveIds.has(id)) lines.push(`${sName}: On Leave`)
            else if (lateIds.has(id)) lines.push(`${sName}: Running Late`)
        }
        return lines
    })()

    return `
CURRENT DATE/TIME: ${new Date().toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}

USER PROFILE:
- Name: ${name} (first name: ${firstName})
- Email: ${(profile as any)?.email ?? 'Unknown'}
- Job title: ${(profile as any)?.job_title ?? 'Not set'}
- Department: ${deptName}
- Desk extension: ${(profile as any)?.desk_extension ?? 'Not set'}
- Phone: ${(profile as any)?.phone ?? 'Not set'}
- Joined: ${joinedAt}
- Birthday: ${(profile as any)?.birthday ?? 'Not set'}

TODAY'S ATTENDANCE:
${attendanceToday}

THIS WEEK'S ATTENDANCE:
${weekDetails.length > 0 ? weekDetails.join('\n') : 'No attendance records this week'}
Total this week: ${weekHours.toFixed(1)} hours
Weekly target: ${weeklyTarget.toFixed(1)} hours
Overtime/deficit: ${weekHours >= weeklyTarget ? `+${(weekHours - weeklyTarget).toFixed(1)}h ahead` : `-${(weeklyTarget - weekHours).toFixed(1)}h behind`}

LEAVE BALANCES:
${leaveLines.length > 0 ? leaveLines.join('\n') : 'No leave balances found'}
Note: Annual leave balances reset on 31 December each year. Unused days may be carried forward (up to the carry forward limit).

UPCOMING/PENDING LEAVE:
${leaveLines2.length > 0 ? leaveLines2.join('\n') : 'No upcoming or pending leave'}

WORK SCHEDULE:
- Working days: ${workDays.join(', ')}
- Daily hours: ${dailyHours}h
- Weekly target: ${weeklyTarget.toFixed(1)}h

LEAVE APPROVERS:
${approverNames || 'No approvers set'}

TEAM LEAVE THIS WEEK (${weekStartStr} to ${weekEndStr}):
${thisWeekLeaveLines.length > 0 ? thisWeekLeaveLines.join('\n') : 'No colleagues on leave this week'}

TEAM LEAVE NEXT WEEK (${nextWeekStartStr} to ${nextWeekEndStr}):
${nextWeekLeaveLines.length > 0 ? nextWeekLeaveLines.join('\n') : 'No colleagues on leave next week'}

UPCOMING TEAM BIRTHDAYS (next 7 days):
${upcomingBirthdays.length > 0 ? upcomingBirthdays.join('\n') : 'No upcoming birthdays in the next 7 days'}

RECENT EXPENSES (your last 5):
${expenseLines.length > 0 ? expenseLines.join('\n') : 'No recent expenses'}

ACTIVE POLLS:
${pollLines.length > 0 ? pollLines.join('\n') : 'No active polls right now'}

RECENT ANNOUNCEMENTS:
${announcementLines.length > 0 ? announcementLines.join('\n') : 'No recent announcements'}

OFFICE TODAY (who's in/out — only share status, NOT clock times):
${officeTodayLines.length > 0 ? officeTodayLines.join('\n') : 'No data yet'}
`.trim()
}
