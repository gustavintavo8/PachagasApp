ALTER TABLE public.match_participants
  ADD COLUMN IF NOT EXISTS has_paid boolean NOT NULL DEFAULT false;
