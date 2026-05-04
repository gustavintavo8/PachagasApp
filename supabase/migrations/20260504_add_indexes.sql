-- supabase/migrations/20260504_add_indexes.sql

-- Consultas de participantes por partido (match detail, score, teams)
CREATE INDEX IF NOT EXISTS idx_match_participants_match_id
  ON match_participants(match_id);

-- Consultas de participantes por usuario (dashboard, history)
CREATE INDEX IF NOT EXISTS idx_match_participants_user_id
  ON match_participants(user_id);

-- Votos MVP por partido
CREATE INDEX IF NOT EXISTS idx_mvp_votes_match_id
  ON mvp_votes(match_id);

-- Notificaciones no leídas del usuario
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read) WHERE read = false;

-- Historial de ELO por usuario (gráfica en perfil)
CREATE INDEX IF NOT EXISTS idx_rp_history_user_id
  ON rp_history(user_id);
