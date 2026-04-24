-- supabase/migrations/20260424000002_add_get_common_matches_rpc.sql

CREATE OR REPLACE FUNCTION get_common_matches(user_a uuid, user_b uuid)
RETURNS TABLE (
  match_id   uuid,
  date       timestamptz,
  location   text,
  team_a_score int,
  team_b_score int,
  user_a_team  text,
  user_b_team  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.id          AS match_id,
    m.date,
    m.location,
    m.team_a_score,
    m.team_b_score,
    pa.team       AS user_a_team,
    pb.team       AS user_b_team
  FROM matches m
  JOIN match_participants pa ON pa.match_id = m.id AND pa.user_id = user_a
  JOIN match_participants pb ON pb.match_id = m.id AND pb.user_id = user_b
  WHERE m.status = 'finished'
  ORDER BY m.date DESC;
$$;
