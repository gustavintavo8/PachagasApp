-- supabase/migrations/20260504_add_indexes.sql

-- Consultas de participantes por partido (match detail, score, teams)
CREATE INDEX IF NOT EXISTS idx_match_participants_match_id
  ON match_participants(match_id);

-- Notificaciones no leídas del usuario (partial index)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read) WHERE read = false;
