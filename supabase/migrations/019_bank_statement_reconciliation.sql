-- Add reconciliation sign-off columns to bank_statements
ALTER TABLE public.bank_statements
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES public.user_profiles(id);
