begin;

-- The API roles can evaluate this helper from policies, but the private schema is
-- intentionally not part of the exposed PostgREST schemas. The function only uses the
-- current JWT subject and runs as the owner, so its catalog lookups do not recurse through
-- the policies it protects.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create or replace function private.has_community_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select exists (
    select 1
    from public.community_access_grants
    where user_id = auth.uid()
      and revoked_at is null
  )
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

alter function private.has_community_access() owner to postgres;
revoke all on function private.has_community_access() from public, anon, authenticated;
grant execute on function private.has_community_access() to anon, authenticated;

-- Middleware cannot query the private schema through PostgREST. Expose only the boolean
-- decision it needs; no grant/profile rows or arbitrary user ID can be requested.
create or replace function public.current_user_has_community_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
  select private.has_community_access();
$$;

alter function public.current_user_has_community_access() owner to postgres;
revoke all on function public.current_user_has_community_access() from public, anon, authenticated;
grant execute on function public.current_user_has_community_access() to anon, authenticated;

-- Anonymous sessions must not be able to reach application tables through the Data API.
revoke all on table public.community_access_grants from anon;
revoke all on table public.seasons from anon;
revoke all on table public.season_player_stats from anon;
revoke all on table public.matches from anon;
revoke all on table public.match_participants from anon;
revoke all on table public.profiles from anon;
revoke all on table public.match_photos from anon;
revoke all on table public.match_comments from anon;
revoke all on table public.mvp_votes from anon;
revoke all on table public.notifications from anon;
revoke all on table public.rp_history from anon;
revoke all on table public.rate_limits from anon;

revoke insert, update, delete on table public.community_access_grants from authenticated;
grant select on table public.community_access_grants to authenticated;
grant select on table public.rp_history to authenticated;

-- Remove the old public/per-role policies whose predicates were true for every caller.
drop policy if exists "authenticated users can read seasons" on public.seasons;
drop policy if exists "authenticated users can read seasonal stats" on public.season_player_stats;
drop policy if exists "Cualquiera puede leer el chat" on public.match_comments;
drop policy if exists "Usuarios autenticados escriben" on public.match_comments;
drop policy if exists "Cualquiera puede ver info de fotos" on public.match_photos;
drop policy if exists "Usuarios autenticados suben info" on public.match_photos;
drop policy if exists "Gestionar partidos auth" on public.matches;
drop policy if exists "Ver partidos todos" on public.matches;
drop policy if exists "matches_select_public" on public.matches;
drop policy if exists "Unirse a partido auth" on public.match_participants;
drop policy if exists "Ver participantes todos" on public.match_participants;
drop policy if exists "participants_select_public" on public.match_participants;
drop policy if exists "mvp_votes_select_public" on public.mvp_votes;
drop policy if exists "profiles_select_public" on public.profiles;

alter table public.community_access_grants enable row level security;
alter table public.seasons enable row level security;
alter table public.season_player_stats enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.profiles enable row level security;
alter table public.match_photos enable row level security;
alter table public.match_comments enable row level security;
alter table public.mvp_votes enable row level security;
alter table public.notifications enable row level security;
alter table public.rp_history enable row level security;
alter table public.rate_limits enable row level security;

drop policy if exists "access grants select own" on public.community_access_grants;
create policy "access grants select own"
  on public.community_access_grants
  for select to authenticated
  using (private.has_community_access());

create policy "authenticated users can read seasons"
  on public.seasons
  for select to authenticated
  using (private.has_community_access());

create policy "authenticated users can read seasonal stats"
  on public.season_player_stats
  for select to authenticated
  using (private.has_community_access());

create policy "community users read matches"
  on public.matches
  for select to authenticated
  using (private.has_community_access());

create policy "community users read participants"
  on public.match_participants
  for select to authenticated
  using (private.has_community_access());

create policy "community users read profiles"
  on public.profiles
  for select to authenticated
  using (private.has_community_access());

create policy "community users read photos"
  on public.match_photos
  for select to authenticated
  using (private.has_community_access());

create policy "community users insert photos"
  on public.match_photos
  for insert to authenticated
  with check (private.has_community_access());

create policy "community users read comments"
  on public.match_comments
  for select to authenticated
  using (private.has_community_access());

create policy "community users insert comments"
  on public.match_comments
  for insert to authenticated
  with check (private.has_community_access());

create policy "community users read votes"
  on public.mvp_votes
  for select to authenticated
  using (private.has_community_access());

create policy "community users read rp history"
  on public.rp_history
  for select to authenticated
  using (private.has_community_access());

-- This is the only non-public participant update path needed by the app: the organizer
-- (or an administrator) can generate teams. The common restrictive policy below still
-- denies the operation to an authenticated JWT without an active grant.
create policy "participants update match manager"
  on public.match_participants
  for update to authenticated
  using (
    private.has_community_access()
    and (
      auth.uid() = (select created_by from public.matches where id = match_id)
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and is_admin = true
      )
    )
  )
  with check (private.has_community_access());

-- Restrictive policies compose with all remaining app-specific policies. They provide the
-- invariant that every read/write path for an authenticated caller requires the grant or
-- administrator bypass, including legacy policies retained for compatibility.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'seasons',
    'season_player_stats',
    'matches',
    'match_participants',
    'profiles',
    'match_photos',
    'match_comments',
    'mvp_votes',
    'notifications',
    'rp_history'
  ] loop
    execute format('drop policy if exists "community access required" on public.%I', table_name);
    if table_name = 'profiles' then
      execute format(
        'create policy "community access required" on public.%I as restrictive for all to authenticated using (private.has_community_access()) with check (private.has_community_access())',
        table_name
      );
    else
      execute format(
        'create policy "community access required" on public.%I as restrictive for all to authenticated using (private.has_community_access()) with check (private.has_community_access())',
        table_name
      );
    end if;
  end loop;
end;
$$;

create or replace function public.verify_private_access_rls_contract()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private, auth
as $$
with app_tables(name) as (
  values
    ('seasons'),
    ('season_player_stats'),
    ('matches'),
    ('match_participants'),
    ('profiles'),
    ('match_photos'),
    ('match_comments'),
    ('mvp_votes'),
    ('notifications'),
    ('rp_history')
), helper_check as (
  select
    to_regprocedure('private.has_community_access()') is not null as helper_present,
    p.prosecdef as helper_security_definer,
    coalesce('row_security=off' = any(p.proconfig), false) as helper_bypasses_rls,
    to_regprocedure('public.current_user_has_community_access()') is not null as middleware_rpc_present,
    has_function_privilege('authenticated', 'public.current_user_has_community_access()', 'EXECUTE') as authenticated_can_check_access
  from pg_proc p
  where p.oid = 'private.has_community_access()'::regprocedure
), rls_check as (
  select coalesce(bool_and(c.relrowsecurity), false) as all_rls_enabled
  from app_tables a
  join pg_class c on c.relname = a.name and c.relnamespace = 'public'::regnamespace
), policy_check as (
  select coalesce(bool_and(exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = a.name
      and p.policyname = 'community access required'
      and p.qual ilike '%private.has_community_access%'
  )), false) as all_restrictive_policies_present
  from app_tables a
), privilege_check as (
  select
    coalesce(bool_or(has_table_privilege('anon', format('public.%s', name), 'SELECT')), false) as anon_can_read,
    coalesce(bool_or(
      has_table_privilege('anon', format('public.%s', name), 'INSERT')
      or has_table_privilege('anon', format('public.%s', name), 'UPDATE')
      or has_table_privilege('anon', format('public.%s', name), 'DELETE')
    ), false) as anon_can_write
  from app_tables
), checks as (
  select * from helper_check cross join rls_check cross join policy_check cross join privilege_check
)
select jsonb_build_object(
  'helper_present', coalesce(helper_present, false),
  'helper_security_definer', coalesce(helper_security_definer, false),
  'helper_bypasses_rls', coalesce(helper_bypasses_rls, false),
  'middleware_rpc_present', coalesce(middleware_rpc_present, false),
  'authenticated_can_check_access', coalesce(authenticated_can_check_access, false),
  'all_rls_enabled', all_rls_enabled,
  'all_restrictive_policies_present', all_restrictive_policies_present,
  'anon_can_read', anon_can_read,
  'anon_can_write', anon_can_write,
  'ok', coalesce(helper_present, false)
    and coalesce(helper_security_definer, false)
    and coalesce(helper_bypasses_rls, false)
    and coalesce(middleware_rpc_present, false)
    and coalesce(authenticated_can_check_access, false)
    and all_rls_enabled
    and all_restrictive_policies_present
    and not anon_can_read
    and not anon_can_write
)
from checks;
$$;

revoke all on function public.verify_private_access_rls_contract() from public, anon, authenticated;
grant execute on function public.verify_private_access_rls_contract() to service_role;

commit;
