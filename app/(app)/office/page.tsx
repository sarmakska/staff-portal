import { supabaseAdmin } from '@/lib/supabase/admin'
import OfficeCanvas from './office-canvas'
import type { OfficePerson } from './office-canvas'

export const dynamic = 'force-dynamic'

export default async function OfficePage() {
  const todayStr = new Date().toISOString().split('T')[0]

  const { data: attendanceRaw } = await supabaseAdmin
    .from('attendance')
    .select('user_id, user_profiles:user_id(id, full_name, display_name, gender)')
    .eq('work_date', todayStr)
    .not('clock_in', 'is', null)
    .is('clock_out', null)
    .order('clock_in', { ascending: true })
    .limit(20)

  let femaleIdx = 0, maleIdx = 0
  const persons: OfficePerson[] = (attendanceRaw ?? []).map((a: any) => {
    const profile = a.user_profiles
    const fullName: string = profile?.display_name || profile?.full_name || 'Staff'
    const firstName = fullName.split(' ')[0]
    const gender: string = (profile?.gender ?? 'male').toLowerCase()
    const isFemale = gender === 'female'
    // Female sprites: 0,1,2 — Male sprites: 3,4,5
    const sprite = isFemale ? (femaleIdx++ % 3) : (3 + maleIdx++ % 3)
    return { id: a.user_id ?? String(Math.random()), name: firstName, sprite, gender }
  })

  return <OfficeCanvas persons={persons} />
}
