begin;

-- These SECURITY DEFINER functions are implementation details. They are not used by
-- the web client, and exposing them through PostgREST would bypass the table policies.
-- Keep a service-role escape hatch for trusted maintenance only.
revoke all on function public.get_common_matches(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_common_matches(uuid, uuid)
  to service_role;

-- rateLimit() calls this RPC through the service-role client. The Data API must not be
-- able to invoke either legacy overload or touch its backing bucket directly.
revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;
revoke all on function public.consume_rate_limit(text, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, bigint)
  to service_role;
revoke all on table public.rate_limits from public, anon, authenticated;
grant all on table public.rate_limits to service_role;

-- The community grant policy is intentionally a self-read policy. The service-role
-- client remains the administrative path for checking and redeeming grants.
drop policy if exists "access grants select own" on public.community_access_grants;
create policy "access grants select own"
  on public.community_access_grants
  for select to authenticated
  using (auth.uid() = user_id);

-- A service-role-only SQL contract makes the function grants and the backing table
-- privilege boundary testable without exposing catalog details through PostgREST.
create or replace function public.verify_public_rpc_security_contract()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
with function_checks as (
  select
    to_regprocedure('public.get_common_matches(uuid,uuid)') is not null as common_matches_present,
    has_function_privilege('anon', 'public.get_common_matches(uuid,uuid)', 'EXECUTE') as common_matches_anon_execute,
    has_function_privilege('authenticated', 'public.get_common_matches(uuid,uuid)', 'EXECUTE') as common_matches_authenticated_execute,
    has_function_privilege('service_role', 'public.get_common_matches(uuid,uuid)', 'EXECUTE') as common_matches_service_execute,
    to_regprocedure('public.consume_rate_limit(text,integer,integer)') is not null as rate_limit_integer_present,
    has_function_privilege('anon', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE') as rate_limit_integer_anon_execute,
    has_function_privilege('authenticated', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE') as rate_limit_integer_authenticated_execute,
    has_function_privilege('service_role', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE') as rate_limit_integer_service_execute,
    to_regprocedure('public.consume_rate_limit(text,integer,bigint)') is not null as rate_limit_bigint_present,
    has_function_privilege('anon', 'public.consume_rate_limit(text,integer,bigint)', 'EXECUTE') as rate_limit_bigint_anon_execute,
    has_function_privilege('authenticated', 'public.consume_rate_limit(text,integer,bigint)', 'EXECUTE') as rate_limit_bigint_authenticated_execute,
    has_function_privilege('service_role', 'public.consume_rate_limit(text,integer,bigint)', 'EXECUTE') as rate_limit_bigint_service_execute
), table_checks as (
  select
    has_table_privilege('anon', 'public.rate_limits', 'SELECT') as rate_limits_anon_select,
    has_table_privilege('authenticated', 'public.rate_limits', 'SELECT') as rate_limits_authenticated_select,
    has_table_privilege('service_role', 'public.rate_limits', 'INSERT,UPDATE,DELETE') as rate_limits_service_write
  from function_checks
), policy_checks as (
  select exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'community_access_grants'
      and policyname = 'access grants select own'
      and cmd = 'SELECT'
      and qual ilike '%auth.uid()%'
      and qual ilike '%user_id%'
      and qual not ilike '%private.has_community_access%'
  ) as grants_policy_is_self_read
  from function_checks
), checks as (
  select * from function_checks cross join table_checks cross join policy_checks
)
select jsonb_build_object(
  'common_matches_present', common_matches_present,
  'common_matches_anon_execute', common_matches_anon_execute,
  'common_matches_authenticated_execute', common_matches_authenticated_execute,
  'common_matches_service_execute', common_matches_service_execute,
  'rate_limit_integer_present', rate_limit_integer_present,
  'rate_limit_integer_anon_execute', rate_limit_integer_anon_execute,
  'rate_limit_integer_authenticated_execute', rate_limit_integer_authenticated_execute,
  'rate_limit_integer_service_execute', rate_limit_integer_service_execute,
  'rate_limit_bigint_present', rate_limit_bigint_present,
  'rate_limit_bigint_anon_execute', rate_limit_bigint_anon_execute,
  'rate_limit_bigint_authenticated_execute', rate_limit_bigint_authenticated_execute,
  'rate_limit_bigint_service_execute', rate_limit_bigint_service_execute,
  'rate_limits_anon_select', rate_limits_anon_select,
  'rate_limits_authenticated_select', rate_limits_authenticated_select,
  'rate_limits_service_write', rate_limits_service_write,
  'grants_policy_is_self_read', grants_policy_is_self_read,
  'ok', common_matches_present
    and not common_matches_anon_execute
    and not common_matches_authenticated_execute
    and common_matches_service_execute
    and rate_limit_integer_present
    and not rate_limit_integer_anon_execute
    and not rate_limit_integer_authenticated_execute
    and rate_limit_integer_service_execute
    and rate_limit_bigint_present
    and not rate_limit_bigint_anon_execute
    and not rate_limit_bigint_authenticated_execute
    and rate_limit_bigint_service_execute
    and not rate_limits_anon_select
    and not rate_limits_authenticated_select
    and rate_limits_service_write
    and grants_policy_is_self_read
)
from checks;
$$;

alter function public.verify_public_rpc_security_contract() owner to postgres;
revoke all on function public.verify_public_rpc_security_contract() from public, anon, authenticated;
grant execute on function public.verify_public_rpc_security_contract() to service_role;

commit;
