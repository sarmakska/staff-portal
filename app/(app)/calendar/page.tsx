import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/actions/auth"
import { CalendarClient } from "./calendar-client"
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday, addMonths, subMonths, parseISO, isSameDay
} from "date-fns"

export default async function CalendarPage(
  props: { searchParams?: Promise<{ month?: string }> }
) {
  const govRes = await fetch('https://www.gov.uk/bank-holidays.json', { next: { revalidate: 86400 } })
  const govData = await govRes.json()
  const UK_PUBLIC_HOLIDAYS: { date: string; name: string }[] = govData['england-and-wales'].events.map((e: any) => ({
    date: String(e.date),
    name: String(e.title)
  }))

  const searchParams = await props.searchParams
  const supabase = await createClient()
  const authCtx = await getCurrentUser()
  const user = authCtx!
  const { isAdmin, isReception } = authCtx!

  const canCreateEvents = true

  const currentMonthParam = searchParams?.month
  const baseDate = currentMonthParam ? parseISO(`${currentMonthParam}-01`) : new Date()

  const currentMonthStart = startOfMonth(baseDate)
  const currentMonthEnd = endOfMonth(baseDate)
  const calendarStart = startOfWeek(currentMonthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(currentMonthEnd, { weekStartsOn: 1 })

  const calStartStr = format(calendarStart, "yyyy-MM-dd")
  const calEndStr = format(calendarEnd, "yyyy-MM-dd")

  const { data: dbEvents } = await supabase
    .from("calendar_events")
    .select("*")
    .lte("event_date", calEndStr)
    .gte("event_date", format(subMonths(currentMonthStart, 2), "yyyy-MM-dd"))
    .order("event_date", { ascending: true })

  const publicHolidays = UK_PUBLIC_HOLIDAYS
    .filter(h => { const hd = parseISO(h.date); return hd >= calendarStart && hd <= calendarEnd })
    .map(h => ({
      id: `ph-${h.date}`,
      title: h.name,
      event_date: h.date,
      event_type: "holiday",
      description: "UK Public Holiday",
      user_id: null as string | null,
    }))

  const { data: wfhRecords } = await supabaseAdmin
    .from("wfh_records")
    .select("user_id, wfh_date, wfh_type, user_profiles:user_id(full_name, display_name)")
    .gte("wfh_date", calStartStr)
    .lte("wfh_date", calEndStr)

  const wfhTypeLabel = (t: string) => {
    if (t === 'half_am') return 'Morning'
    if (t === 'half_pm') return 'Afternoon'
    return null
  }

  const wfhEvents = (wfhRecords || []).map((w: any) => {
    const profile = w.user_profiles as any
    const name = profile?.display_name || profile?.full_name || "Unknown"
    const halfLabel = wfhTypeLabel(w.wfh_type)
    const titleSuffix = halfLabel ? `WFH · ${halfLabel}` : "WFH"
    const desc = halfLabel ? `Working from home — ${halfLabel} only` : "Working from home today"
    return {
      id: `wfh-${w.user_id}-${w.wfh_date}`,
      title: `${name} (${titleSuffix})`,
      event_date: w.wfh_date,
      event_type: "wfh",
      description: desc,
      user_id: w.user_id as string | null,
    }
  })

  const { data: approvedLeaves } = await supabaseAdmin
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, day_type, employee:user_profiles!leave_requests_user_id_fkey(full_name, display_name)")
    .eq("status", "approved")
    .lte("start_date", calEndStr)
    .gte("end_date", calStartStr)

  const leaveEvents: any[] = []
  for (const leave of approvedLeaves ?? []) {
    const emp = leave.employee as any
    const empName = emp?.display_name || emp?.full_name || "Employee"
    const leaveLabel = leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)
    const halfSuffix = leave.day_type === "half_am" ? " (Morning)" : leave.day_type === "half_pm" ? " (Afternoon)" : ""
    const days = eachDayOfInterval({
      start: parseISO(leave.start_date) > calendarStart ? parseISO(leave.start_date) : calendarStart,
      end: parseISO(leave.end_date) < calendarEnd ? parseISO(leave.end_date) : calendarEnd,
    })
    for (const day of days) {
      leaveEvents.push({
        id: `leave-${leave.id}-${format(day, "yyyy-MM-dd")}`,
        title: `${empName}`,
        event_date: format(day, "yyyy-MM-dd"),
        event_type: leave.leave_type === "sick" ? "sick" : "leave",
        description: `${leaveLabel} leave${halfSuffix} · ${leave.start_date} to ${leave.end_date}`,
        user_id: null as string | null,
      })
    }
  }

  // Expand multi-day calendar events across each day in their range
  const expandedDbEvents: any[] = []
  for (const e of (dbEvents || []).filter((e: any) => e.event_type !== 'in_office')) {
    if (e.event_end_date && e.event_end_date !== e.event_date) {
      const start = parseISO(e.event_date) > calendarStart ? parseISO(e.event_date) : calendarStart
      const end = parseISO(e.event_end_date) < calendarEnd ? parseISO(e.event_end_date) : calendarEnd
      if (start > end) continue
      const days = eachDayOfInterval({ start, end })
      for (const day of days) {
        expandedDbEvents.push({ ...e, event_date: format(day, "yyyy-MM-dd") })
      }
    } else {
      expandedDbEvents.push(e)
    }
  }

  const rawEvents = [
    ...expandedDbEvents,
    ...publicHolidays,
    ...wfhEvents,
    ...leaveEvents,
  ]

  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const calendarDays = allDays.map(day => {
    const dayStr = format(day, "yyyy-MM-dd")
    const dayEvents = rawEvents
      .filter((e: any) => e.event_date && isSameDay(parseISO(e.event_date.split("T")[0]), day))
      .map((e: any) => {
        // WFH records have id starting with "wfh-"; calendar_events with event_type='wfh' do not
        const isWfhRecord = (e.id as string).startsWith('wfh-')
        const canDelete = isWfhRecord
          ? (isAdmin || isReception)
          : (e.event_type !== 'holiday' && e.event_type !== 'in_office' && (e.user_id === user.id || isAdmin))
        return {
          id: e.id as string,
          title: e.title as string,
          event_type: e.event_type as string,
          description: (e.description ?? null) as string | null,
          canDelete,
          deleteType: (isWfhRecord ? 'wfh' : 'calendar') as 'wfh' | 'calendar',
        }
      })
    return {
      date: dayStr,
      isCurrentMonth: isSameMonth(day, currentMonthStart),
      isToday: isToday(day),
      events: dayEvents,
    }
  })

  return (
    <CalendarClient
      calendarDays={calendarDays}
      prevMonth={format(subMonths(currentMonthStart, 1), "yyyy-MM")}
      nextMonth={format(addMonths(currentMonthStart, 1), "yyyy-MM")}
      currentMonthLabel={format(currentMonthStart, "MMMM yyyy")}
      canCreateEvents={canCreateEvents}
      todayStr={format(new Date(), "yyyy-MM-dd")}
    />
  )
}
