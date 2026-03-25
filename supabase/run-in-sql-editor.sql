-- ============================================================
-- StaffPortal — Apply All Missing Migrations (005 → 010)
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- ============================================================


-- ── MIGRATION 005: Kiosk PIN + External Contacts ─────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS kiosk_pin TEXT;

CREATE TABLE IF NOT EXISTS public.external_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    added_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    job_title TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.external_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='external_contacts' AND policyname='authenticated_read_external_contacts') THEN
    CREATE POLICY "authenticated_read_external_contacts"
      ON public.external_contacts FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='external_contacts' AND policyname='authenticated_insert_external_contacts') THEN
    CREATE POLICY "authenticated_insert_external_contacts"
      ON public.external_contacts FOR INSERT TO authenticated WITH CHECK (added_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='external_contacts' AND policyname='owner_update_external_contacts') THEN
    CREATE POLICY "owner_update_external_contacts"
      ON public.external_contacts FOR UPDATE TO authenticated USING (added_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='external_contacts' AND policyname='owner_or_admin_delete_external_contacts') THEN
    CREATE POLICY "owner_or_admin_delete_external_contacts"
      ON public.external_contacts FOR DELETE TO authenticated
      USING (added_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      ));
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_external_contacts_updated_at ON public.external_contacts;
CREATE TRIGGER set_external_contacts_updated_at
  BEFORE UPDATE ON public.external_contacts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ── MIGRATION 006: Enum Fixes + Indexes ──────────────────────

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'leave_balance_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'user_activated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'user_deactivated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'approver_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'contact_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'contact_deleted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'calendar_event_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'calendar_event_deleted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'kiosk_pin_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'correction_applied';

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_type_year
  ON public.leave_balances(user_id, leave_type, year);

CREATE INDEX IF NOT EXISTS idx_user_approvers_user_priority
  ON public.user_approvers(user_id, priority);


-- ── MIGRATION 007: Fix Admin Profile + RLS ───────────────────

INSERT INTO public.user_profiles (id, email, full_name, display_name, is_active, is_email_verified)
SELECT id, email,
  COALESCE(raw_user_meta_data->>'full_name', 'Sai'),
  COALESCE(raw_user_meta_data->>'full_name', 'Sai'),
  true, true
FROM auth.users WHERE email = 'admin@yourcompany.com'
ON CONFLICT (id) DO UPDATE SET is_active = true, is_email_verified = true, updated_at = now();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'employee' FROM auth.users WHERE email = 'admin@yourcompany.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@yourcompany.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'accounts' FROM auth.users WHERE email = 'admin@yourcompany.com'
ON CONFLICT (user_id, role) DO NOTHING;


-- ── MIGRATION 008: Restore Permissions + Reset RLS ───────────

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Reset RLS on critical tables
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE external_contacts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON user_profiles;
DROP POLICY IF EXISTS "allow_auth_read_profiles" ON user_profiles;
DROP POLICY IF EXISTS "authenticated: read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "authenticated: read basic directory" ON user_profiles;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON user_roles;
DROP POLICY IF EXISTS "allow_auth_read_roles" ON user_roles;
DROP POLICY IF EXISTS "authenticated: read all roles" ON user_roles;
DROP POLICY IF EXISTS "admin: read all roles" ON user_roles;

DROP POLICY IF EXISTS "admin_accounts_read_all_balances" ON leave_balances;
DROP POLICY IF EXISTS "accounts: read all leave balances" ON leave_balances;
DROP POLICY IF EXISTS "allow_owner_read_balances" ON leave_balances;
DROP POLICY IF EXISTS "allow_admin_read_balances" ON leave_balances;

DROP POLICY IF EXISTS "everyone_read_contacts" ON external_contacts;
DROP POLICY IF EXISTS "allow_auth_read_contacts" ON external_contacts;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_auth_read_profiles" ON user_profiles FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY "allow_auth_read_roles" ON user_roles FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY "allow_auth_read_contacts" ON external_contacts FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY "allow_owner_read_balances" ON leave_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_admin_read_balances" ON leave_balances FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'accounts'))
);


-- ── MIGRATION 009: Gender Column + Leave Type Enums ──────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'leave_type' AND e.enumlabel = 'maternity') THEN
    ALTER TYPE leave_type ADD VALUE 'maternity';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'leave_type' AND e.enumlabel = 'paternity') THEN
    ALTER TYPE leave_type ADD VALUE 'paternity';
  END IF;
END $$;


-- ── MIGRATION 010: Visitor Phone + Departments ───────────────

ALTER TABLE visitors ADD COLUMN IF NOT EXISTS visitor_phone text;

-- Clear and reseed departments with correct names
UPDATE user_profiles SET department_id = NULL;
DELETE FROM departments;

INSERT INTO departments (name) VALUES
  ('C-Suite'),
  ('Design'),
  ('Sales'),
  ('Merchandise'),
  ('QC'),
  ('Logistics'),
  ('Office Manager'),
  ('Accountant');


-- ── RELOAD SCHEMA CACHE ──────────────────────────────────────
-- After running this, go to: Supabase Dashboard → Settings → API → click "Reload schema cache"
-- OR just wait 60 seconds for it to auto-refresh.

SELECT 'All migrations applied successfully' AS status;


-- ── MIGRATIONS 013 + 014: Carry-Forward ──────────────────────

ALTER TABLE leave_balances
    ADD COLUMN IF NOT EXISTS carried_forward NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS max_carry_forward SMALLINT NOT NULL DEFAULT 5;

SELECT 'Migrations 013 + 014 applied' AS status;


-- ── MIGRATION 015: Remove personal + compassionate leave ──────
-- Delete all personal and compassionate leave balances (they are unused)
DELETE FROM leave_balances WHERE leave_type IN ('personal', 'compassionate');

-- Update auth trigger so new users only get annual + sick leave
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, display_name, is_active, is_email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    true,
    COALESCE((NEW.raw_user_meta_data->>'email_confirmed')::boolean, false)
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.leave_balances (user_id, leave_type, total, year) VALUES
    (NEW.id, 'annual', 25, EXTRACT(YEAR FROM now())),
    (NEW.id, 'sick',   10, EXTRACT(YEAR FROM now()))
  ON CONFLICT (user_id, leave_type, year) DO NOTHING;

  RETURN NEW;
END;
$$;

SELECT 'Migration 015 applied' AS status;
