create table if not exists public.community_access_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null check (status in ('active', 'archived')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists seasons_one_active_idx
  on public.seasons (status) where status = 'active';

create table if not exists public.season_player_stats (
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  elo_rating integer not null default 1000 check (elo_rating >= 100),
  matches_played integer not null default 0 check (matches_played >= 0),
  goals_scored integer not null default 0 check (goals_scored >= 0),
  wins integer not null default 0 check (wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  losses integer not null default 0 check (losses >= 0),
  mvps integer not null default 0 check (mvps >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id)
);

alter table public.matches
  add column if not exists season_id uuid references public.seasons(id);

alter table public.rp_history
  add column if not exists season_id uuid references public.seasons(id);

insert into public.seasons (name, slug, status, starts_at, ends_at)
select
  'Temporada 1',
  'season-1',
  'archived',
  coalesce((select min(date) from public.matches), now()),
  now()
where not exists (
  select 1
  from public.seasons
  where slug = 'season-1'
);

insert into public.seasons (name, slug, status, starts_at, ends_at)
select
  'Temporada 2',
  'season-2',
  'active',
  now(),
  null
where not exists (
  select 1
  from public.seasons
  where slug = 'season-2'
);

update public.matches
set season_id = (
  select id
  from public.seasons
  where slug = 'season-1'
)
where season_id is null;

update public.rp_history
set season_id = (
  select id
  from public.seasons
  where slug = 'season-1'
)
where season_id is null;

with season_one as (
  select id
  from public.seasons
  where slug = 'season-1'
), season_two as (
  select id
  from public.seasons
  where slug = 'season-2'
), match_aggregates as (
  select
    mp.user_id,
    count(*) filter (where mp.team in ('A', 'B'))::integer as matches_played,
    coalesce(sum(mp.goals) filter (where mp.team in ('A', 'B')), 0)::integer as goals_scored,
    (
      count(*) filter (
        where mp.team = 'A'
          and m.team_a_score > m.team_b_score
      )
      +
      count(*) filter (
        where mp.team = 'B'
          and m.team_b_score > m.team_a_score
      )
    )::integer as wins,
    count(*) filter (
      where mp.team in ('A', 'B')
        and m.team_a_score = m.team_b_score
    )::integer as draws,
    (
      count(*) filter (
        where mp.team = 'A'
          and m.team_a_score < m.team_b_score
      )
      +
      count(*) filter (
        where mp.team = 'B'
          and m.team_b_score < m.team_a_score
      )
    )::integer as losses,
    count(*) filter (where mp.is_mvp and mp.team in ('A', 'B'))::integer as mvps
  from public.match_participants mp
  join public.matches m on m.id = mp.match_id
  where m.status = 'finished'
  group by mp.user_id
)
insert into public.season_player_stats (
  season_id,
  user_id,
  elo_rating,
  matches_played,
  goals_scored,
  wins,
  draws,
  losses,
  mvps
)
select
  season_one.id,
  p.id,
  p.elo_rating,
  coalesce(p.matches_played, ma.matches_played, 0),
  coalesce(p.goals_scored, ma.goals_scored, 0),
  coalesce(ma.wins, 0),
  coalesce(ma.draws, 0),
  coalesce(ma.losses, 0),
  coalesce(ma.mvps, 0)
from public.profiles p
cross join season_one
left join match_aggregates ma on ma.user_id = p.id
on conflict (season_id, user_id) do nothing;

insert into public.season_player_stats (
  season_id,
  user_id,
  matches_played,
  goals_scored,
  wins,
  draws,
  losses,
  mvps
)
select
  season_two.id,
  p.id,
  0,
  0,
  0,
  0,
  0,
  0
from public.profiles p
cross join (
  select id
  from public.seasons
  where slug = 'season-2'
) season_two
on conflict (season_id, user_id) do nothing;

alter table public.matches
  alter column season_id set not null;

alter table public.rp_history
  alter column season_id set not null;

create index if not exists idx_matches_season_date
  on public.matches (season_id, date desc);

create index if not exists idx_rp_history_season_user_created
  on public.rp_history (season_id, user_id, created_at);

create index if not exists idx_season_player_stats_season_elo
  on public.season_player_stats (season_id, elo_rating desc);

alter table public.community_access_grants enable row level security;
alter table public.seasons enable row level security;
alter table public.season_player_stats enable row level security;

create policy "access grants select own"
  on public.community_access_grants
  for select
  using (auth.uid() = user_id);

create policy "authenticated users can read seasons"
  on public.seasons
  for select
  to authenticated
  using (true);

create policy "authenticated users can read seasonal stats"
  on public.season_player_stats
  for select
  to authenticated
  using (true);

revoke all on table public.community_access_grants from public, anon, authenticated;
revoke all on table public.seasons from public, anon, authenticated;
revoke all on table public.season_player_stats from public, anon, authenticated;
grant select on table public.community_access_grants to authenticated;
grant select on table public.seasons to authenticated;
grant select on table public.season_player_stats to authenticated;
grant all on table public.community_access_grants to service_role;
grant all on table public.seasons to service_role;
grant all on table public.season_player_stats to service_role;

create or replace function public.rebuild_season_player_stats(
  p_season_id uuid,
  p_user_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
with stats as (
  select
    count(*) filter (where mp.team in ('A', 'B'))::integer as matches_played,
    coalesce(sum(mp.goals) filter (where mp.team in ('A', 'B')), 0)::integer as goals_scored,
    (
      count(*) filter (
        where mp.team = 'A'
          and m.team_a_score > m.team_b_score
      )
      +
      count(*) filter (
        where mp.team = 'B'
          and m.team_b_score > m.team_a_score
      )
    )::integer as wins,
    count(*) filter (
      where mp.team in ('A', 'B')
        and m.team_a_score = m.team_b_score
    )::integer as draws,
    (
      count(*) filter (
        where mp.team = 'A'
          and m.team_a_score < m.team_b_score
      )
      +
      count(*) filter (
        where mp.team = 'B'
          and m.team_b_score < m.team_a_score
      )
    )::integer as losses,
    count(*) filter (where mp.is_mvp and mp.team in ('A', 'B'))::integer as mvps
  from public.match_participants mp
  join public.matches m on m.id = mp.match_id
  where mp.user_id = p_user_id
    and m.season_id = p_season_id
    and m.status = 'finished'
)
insert into public.season_player_stats (
  season_id,
  user_id,
  elo_rating,
  matches_played,
  goals_scored,
  wins,
  draws,
  losses,
  mvps
)
select
  p_season_id,
  p_user_id,
  coalesce(existing.elo_rating, p.elo_rating, 1000),
  coalesce(stats.matches_played, 0),
  coalesce(stats.goals_scored, 0),
  coalesce(stats.wins, 0),
  coalesce(stats.draws, 0),
  coalesce(stats.losses, 0),
  coalesce(stats.mvps, 0)
from public.profiles p
left join public.season_player_stats existing
  on existing.season_id = p_season_id
 and existing.user_id = p_user_id
cross join stats
where p.id = p_user_id
on conflict (season_id, user_id) do update
set
  matches_played = excluded.matches_played,
  goals_scored = excluded.goals_scored,
  wins = excluded.wins,
  draws = excluded.draws,
  losses = excluded.losses,
  mvps = excluded.mvps;
$$;

revoke all on function public.rebuild_season_player_stats(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rebuild_season_player_stats(uuid, uuid) to service_role;

create or replace function public.verify_season_migration_contract()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
with expected_indexes(name) as (
  values
    ('seasons_one_active_idx'),
    ('idx_matches_season_date'),
    ('idx_rp_history_season_user_created'),
    ('idx_season_player_stats_season_elo')
),
index_checks as (
  select coalesce(bool_and(indexname is not null), false) as indexes_present
  from expected_indexes e
  left join pg_indexes i on i.schemaname = 'public' and i.indexname = e.name
),
rls_checks as (
  select coalesce(bool_and(c.relrowsecurity), false) as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('community_access_grants', 'seasons', 'season_player_stats')
),
policy_checks as (
  select
    exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'community_access_grants'
        and policyname = 'access grants select own'
        and cmd = 'SELECT'
    ) as grants_policy,
    exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'seasons'
        and policyname = 'authenticated users can read seasons'
        and cmd = 'SELECT'
    ) as seasons_policy,
    exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'season_player_stats'
        and policyname = 'authenticated users can read seasonal stats'
        and cmd = 'SELECT'
    ) as stats_policy
), function_checks as (
  select
    to_regprocedure('public.rebuild_season_player_stats(uuid,uuid)') is not null as repair_function_present,
    has_function_privilege('service_role', 'public.rebuild_season_player_stats(uuid,uuid)', 'EXECUTE') as service_role_can_repair,
    has_function_privilege('authenticated', 'public.rebuild_season_player_stats(uuid,uuid)', 'EXECUTE') as authenticated_can_repair,
    has_function_privilege('anon', 'public.rebuild_season_player_stats(uuid,uuid)', 'EXECUTE') as anon_can_repair
), table_privilege_checks as (
  select
    has_table_privilege('authenticated', 'public.community_access_grants', 'SELECT') as authenticated_can_read_grants,
    has_table_privilege('authenticated', 'public.seasons', 'SELECT') as authenticated_can_read_seasons,
    has_table_privilege('authenticated', 'public.season_player_stats', 'SELECT') as authenticated_can_read_stats,
    has_table_privilege('anon', 'public.community_access_grants', 'SELECT') as anon_can_read_grants,
    has_table_privilege('anon', 'public.seasons', 'SELECT') as anon_can_read_seasons,
    has_table_privilege('anon', 'public.season_player_stats', 'SELECT') as anon_can_read_stats,
    has_table_privilege('authenticated', 'public.community_access_grants', 'INSERT,UPDATE,DELETE') as authenticated_can_write_grants,
    has_table_privilege('authenticated', 'public.seasons', 'INSERT,UPDATE,DELETE') as authenticated_can_write_seasons,
    has_table_privilege('authenticated', 'public.season_player_stats', 'INSERT,UPDATE,DELETE') as authenticated_can_write_stats,
    has_table_privilege('anon', 'public.community_access_grants', 'INSERT,UPDATE,DELETE') as anon_can_write_grants,
    has_table_privilege('anon', 'public.seasons', 'INSERT,UPDATE,DELETE') as anon_can_write_seasons,
    has_table_privilege('anon', 'public.season_player_stats', 'INSERT,UPDATE,DELETE') as anon_can_write_stats,
    has_table_privilege('service_role', 'public.community_access_grants', 'INSERT,UPDATE,DELETE') as service_role_can_write_grants,
    has_table_privilege('service_role', 'public.seasons', 'INSERT,UPDATE,DELETE') as service_role_can_write_seasons,
    has_table_privilege('service_role', 'public.season_player_stats', 'INSERT,UPDATE,DELETE') as service_role_can_write_stats
), checks as (
  select * from index_checks cross join rls_checks cross join policy_checks
    cross join function_checks cross join table_privilege_checks
)
select jsonb_build_object(
  'indexes_present', indexes_present,
  'rls_enabled', rls_enabled,
  'policies_present', grants_policy and seasons_policy and stats_policy,
  'repair_function_present', repair_function_present,
  'service_role_can_repair', service_role_can_repair,
  'authenticated_can_repair', authenticated_can_repair,
  'anon_can_repair', anon_can_repair,
  'authenticated_can_read_grants', authenticated_can_read_grants,
  'authenticated_can_read_seasons', authenticated_can_read_seasons,
  'authenticated_can_read_stats', authenticated_can_read_stats,
  'anon_can_read_grants', anon_can_read_grants,
  'anon_can_read_seasons', anon_can_read_seasons,
  'anon_can_read_stats', anon_can_read_stats,
  'authenticated_can_write_grants', authenticated_can_write_grants,
  'authenticated_can_write_seasons', authenticated_can_write_seasons,
  'authenticated_can_write_stats', authenticated_can_write_stats,
  'anon_can_write_grants', anon_can_write_grants,
  'anon_can_write_seasons', anon_can_write_seasons,
  'anon_can_write_stats', anon_can_write_stats,
  'service_role_can_write_grants', service_role_can_write_grants,
  'service_role_can_write_seasons', service_role_can_write_seasons,
  'service_role_can_write_stats', service_role_can_write_stats,
  'ok', indexes_present
    and rls_enabled
    and grants_policy and seasons_policy and stats_policy
    and repair_function_present
    and service_role_can_repair
    and not authenticated_can_repair
    and not anon_can_repair
    and authenticated_can_read_grants
    and authenticated_can_read_seasons
    and authenticated_can_read_stats
    and not anon_can_read_grants
    and not anon_can_read_seasons
    and not anon_can_read_stats
    and not authenticated_can_write_grants
    and not authenticated_can_write_seasons
    and not authenticated_can_write_stats
    and not anon_can_write_grants
    and not anon_can_write_seasons
    and not anon_can_write_stats
    and service_role_can_write_grants
    and service_role_can_write_seasons
    and service_role_can_write_stats
)
from checks;
$$;

revoke all on function public.verify_season_migration_contract() from public, anon, authenticated;
grant execute on function public.verify_season_migration_contract() to service_role;
