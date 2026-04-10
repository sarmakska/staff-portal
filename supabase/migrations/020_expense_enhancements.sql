-- Migration 020: Expense enhancements
-- GL codes, department allocation, reimbursement tracking, comments, audit log

-- 1. GL code on expense categories
ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS gl_code TEXT;

-- 2. Department allocation on expenses (reuse existing departments table)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- 3. Reimbursement tracking on expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS reimbursed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reimbursed_via  TEXT,        -- 'BACS' | 'Payroll' | 'Cash'
  ADD COLUMN IF NOT EXISTS reimbursement_ref TEXT;       -- e.g. BACS reference or payroll run ref

-- 4. Expense comments (approver/employee discussion thread)
CREATE TABLE IF NOT EXISTS public.expense_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID        NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.user_profiles(id),
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_comments_expense ON public.expense_comments(expense_id);

-- 5. Expense audit log (track all edits, status changes, approvals)
CREATE TABLE IF NOT EXISTS public.expense_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID        NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.user_profiles(id),
  action      TEXT        NOT NULL,  -- 'created' | 'updated' | 'approved' | 'rejected' | 'paid' | 'reimbursed'
  changes     JSONB,                 -- { "amount": { "from": 100, "to": 120 }, ... }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_audit_expense ON public.expense_audit_log(expense_id);

-- ── Grants ────────────────────────────────────────────────────────
GRANT ALL ON public.expense_comments    TO anon, authenticated, service_role;
GRANT ALL ON public.expense_audit_log   TO anon, authenticated, service_role;
