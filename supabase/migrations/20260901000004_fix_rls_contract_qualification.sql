-- The RLS contract function runs with a hardened search_path. In that context
-- pg_policies.qual deparses the helper without its schema qualification, so the
-- previous check for `private.has_community_access` returned false on valid policies.
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
      and p.qual ilike '%has_community_access()%'
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
