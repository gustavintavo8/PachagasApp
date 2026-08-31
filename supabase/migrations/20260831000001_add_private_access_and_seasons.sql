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
cross join season_two
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

grant all on table public.community_access_grants to anon, authenticated, service_role;
grant all on table public.seasons to anon, authenticated, service_role;
grant all on table public.season_player_stats to anon, authenticated, service_role;

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
