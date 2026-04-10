-- Migration 021: Purchase Requests (Invoice Manager)
-- Creates purchase_requests, pr_approvals, pr_attachments tables
-- with proper RLS so supabaseAdmin (service role) can read/write freely

-- ── Enums ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE pr_status AS ENUM ('submitted','approved','rejected','ordered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  item_name         TEXT        NOT NULL,
  description       TEXT,
  estimated_cost    NUMERIC(10,2) NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'GBP',
  converted_gbp     NUMERIC(10,2),
  exchange_rate     NUMERIC(10,6) DEFAULT 1,
  supplier          TEXT,
  justification     TEXT,
  urgency           TEXT        NOT NULL DEFAULT 'medium',
  approval_chain_id UUID        REFERENCES public.expense_approval_chains(id),
  direct_approver_id UUID       REFERENCES public.user_profiles(id),
  current_step      INTEGER     DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'submitted',
  notes             TEXT,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pr_approvals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id        UUID        NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  step         INTEGER     NOT NULL,
  approver_id  UUID        NOT NULL REFERENCES public.user_profiles(id),
  decision     TEXT        NOT NULL DEFAULT 'pending',
  note         TEXT,
  decided_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pr_attachments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id       UUID        NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  file_url    TEXT        NOT NULL,
  file_name   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_purchase_requests_user   ON public.purchase_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON public.purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr_approvals_pr          ON public.pr_approvals(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_attachments_pr        ON public.pr_attachments(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_direct_approver       ON public.purchase_requests(direct_approver_id);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_approvals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_attachments    ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically; no extra policy needed.
-- Authenticated users: read own rows (server actions use service role for cross-user ops)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_requests' AND policyname = 'Users can read own PRs') THEN
    CREATE POLICY "Users can read own PRs" ON public.purchase_requests FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pr_approvals' AND policyname = 'Users can read own PR approvals') THEN
    CREATE POLICY "Users can read own PR approvals" ON public.pr_approvals FOR SELECT USING (EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = pr_id AND pr.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pr_attachments' AND policyname = 'Users can read own PR attachments') THEN
    CREATE POLICY "Users can read own PR attachments" ON public.pr_attachments FOR SELECT USING (EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = pr_id AND pr.user_id = auth.uid()));
  END IF;
END $$;

-- ── Grants ────────────────────────────────────────────────────────
GRANT ALL ON public.purchase_requests TO anon, authenticated, service_role;
GRANT ALL ON public.pr_approvals      TO anon, authenticated, service_role;
GRANT ALL ON public.pr_attachments    TO anon, authenticated, service_role;
