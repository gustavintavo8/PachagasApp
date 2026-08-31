drop trigger if exists match_finished_stats_trigger on public.matches;
drop function if exists public.update_profile_stats_on_match_finished();

create or replace function public.update_season_stats_on_match_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'finished' or old.status = 'finished' then
    return new;
  end if;

  insert into public.season_player_stats (
    season_id,
    user_id
  )
  select
    new.season_id,
    mp.user_id
  from public.match_participants mp
  where mp.match_id = new.id
  on conflict (season_id, user_id) do nothing;

  insert into public.season_player_stats (
    season_id,
    user_id,
    matches_played,
    goals_scored,
    wins,
    draws,
    losses
  )
  select
    new.season_id,
    mp.user_id,
    case when mp.team in ('A', 'B') then 1 else 0 end,
    case when mp.team in ('A', 'B') then coalesce(mp.goals, 0) else 0 end,
    case
      when mp.team = 'A' and new.team_a_score > new.team_b_score then 1
      when mp.team = 'B' and new.team_b_score > new.team_a_score then 1
      else 0
    end,
    case
      when mp.team in ('A', 'B') and new.team_a_score = new.team_b_score then 1
      else 0
    end,
    case
      when mp.team = 'A' and new.team_a_score < new.team_b_score then 1
      when mp.team = 'B' and new.team_b_score < new.team_a_score then 1
      else 0
    end
  from public.match_participants mp
  where mp.match_id = new.id
  on conflict (season_id, user_id) do update
  set
    matches_played = public.season_player_stats.matches_played + excluded.matches_played,
    goals_scored = public.season_player_stats.goals_scored + excluded.goals_scored,
    wins = public.season_player_stats.wins + excluded.wins,
    draws = public.season_player_stats.draws + excluded.draws,
    losses = public.season_player_stats.losses + excluded.losses,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.update_season_stats_on_match_finished() from public, anon, authenticated;
grant execute on function public.update_season_stats_on_match_finished() to service_role;

create trigger match_finished_stats_trigger
after update on public.matches
for each row
execute function public.update_season_stats_on_match_finished();
