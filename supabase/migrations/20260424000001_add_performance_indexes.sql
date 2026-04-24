-- supabase/migrations/20260424000001_add_performance_indexes.sql

CREATE INDEX IF NOT EXISTS idx_match_participants_match_id
  ON match_participants(match_id);

CREATE INDEX IF NOT EXISTS idx_match_participants_user_id
  ON match_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_rp_history_user_id
  ON rp_history(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read
  ON notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_mvp_votes_match_id
  ON mvp_votes(match_id);
