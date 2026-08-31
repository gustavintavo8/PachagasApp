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

create or replace function public.finalize_match_with_elo(
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_finished_at timestamptz,
  p_elo_updates jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  match_season_id uuid;
  elo_update record;
begin
  update public.matches
  set
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score,
    status = 'finished',
    finished_at = p_finished_at
  where id = p_match_id
    and status in ('open', 'closed')
  returning season_id into match_season_id;

  if not found then
    return false;
  end if;

  for elo_update in
    select *
    from jsonb_to_recordset(coalesce(p_elo_updates, '[]'::jsonb)) as entry(
      user_id uuid,
      new_rating integer,
      rp_change integer
    )
  loop
    update public.season_player_stats
    set elo_rating = elo_update.new_rating,
        updated_at = now()
    where season_id = match_season_id
      and user_id = elo_update.user_id;

    if not found then
      raise exception 'Missing season stats row for % in season %', elo_update.user_id, match_season_id;
    end if;

    insert into public.rp_history (
      user_id,
      match_id,
      season_id,
      rp_change,
      new_rp,
      created_at
    ) values (
      elo_update.user_id,
      p_match_id,
      match_season_id,
      elo_update.rp_change,
      elo_update.new_rating,
      p_finished_at
    );
  end loop;

  return true;
end;
$$;

revoke all on function public.finalize_match_with_elo(uuid, integer, integer, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_match_with_elo(uuid, integer, integer, timestamptz, jsonb) to service_role;
