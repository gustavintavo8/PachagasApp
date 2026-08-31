drop function if exists public.finalize_match_with_elo(uuid, integer, integer, timestamptz, jsonb);

create or replace function public.finalize_match_with_elo(
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_finished_at timestamptz,
  p_goal_scorers jsonb,
  p_elo_updates jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  match_season_id uuid;
  goal_scorer record;
  elo_update record;
begin
  select season_id
    into match_season_id
  from public.matches
  where id = p_match_id
    and status in ('open', 'closed')
  for update;

  if not found then
    return false;
  end if;

  for goal_scorer in
    select *
    from jsonb_to_recordset(coalesce(p_goal_scorers, '[]'::jsonb)) as entry(
      user_id uuid,
      goals integer
    )
  loop
    update public.match_participants
    set goals = goal_scorer.goals
    where match_id = p_match_id
      and user_id = goal_scorer.user_id;

    if not found then
      raise exception 'Goal scorer % is not a participant in match %', goal_scorer.user_id, p_match_id;
    end if;
  end loop;

  update public.matches
  set
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score,
    status = 'finished',
    finished_at = p_finished_at
  where id = p_match_id
    and status in ('open', 'closed');

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

revoke all on function public.finalize_match_with_elo(uuid, integer, integer, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_match_with_elo(uuid, integer, integer, timestamptz, jsonb, jsonb) to service_role;

create or replace function public.resolve_mvp_with_stats(
  p_match_id uuid,
  p_winner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  match_season_id uuid;
  current_winner_id uuid;
  participant record;
  changed boolean;
begin
  select season_id
    into match_season_id
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match % not found', p_match_id;
  end if;

  select user_id
    into current_winner_id
  from public.match_participants
  where match_id = p_match_id
    and is_mvp = true
  limit 1;

  if not exists (
    select 1
    from public.match_participants
    where match_id = p_match_id
      and user_id = p_winner_id
  ) then
    raise exception 'MVP winner % is not a participant in match %', p_winner_id, p_match_id;
  end if;

  changed := current_winner_id is distinct from p_winner_id;

  update public.match_participants
  set is_mvp = false
  where match_id = p_match_id;

  update public.match_participants
  set is_mvp = true
  where match_id = p_match_id
    and user_id = p_winner_id;

  insert into public.season_player_stats (season_id, user_id)
  select match_season_id, mp.user_id
  from public.match_participants mp
  where mp.match_id = p_match_id
  on conflict (season_id, user_id) do nothing;

  for participant in
    select distinct mp.user_id
    from public.match_participants mp
    where mp.match_id = p_match_id
  loop
    perform public.rebuild_season_player_stats(match_season_id, participant.user_id);
  end loop;

  return changed;
end;
$$;

revoke all on function public.resolve_mvp_with_stats(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_mvp_with_stats(uuid, uuid) to service_role;
