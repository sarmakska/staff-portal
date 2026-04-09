// ============================================================
// Supabase Client — Browser (Client Components)
// Uses the anon key only. RLS enforced by Supabase.
// ============================================================

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  const url = 'https://imhwbpkaxfuamrxzljdx.supabase.co'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltaHdicGtheGZ1YW1yeHpsamR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODU4NDAsImV4cCI6MjA4ODA2MTg0MH0.iXf_5zPxxBoOiAuStMZU4A4TYVkdXVRgkz7ixdyvO7s'

  return createBrowserClient<Database>(url, anonKey)
}
