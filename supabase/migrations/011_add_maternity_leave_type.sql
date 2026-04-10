-- Add 'maternity' to the leave_type enum
-- This was missing, causing maternity leave balance saves to silently fail
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'maternity';
