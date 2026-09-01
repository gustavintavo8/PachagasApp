-- PostgREST cannot disambiguate the two historical consume_rate_limit overloads
-- from JSON numeric arguments. Keep both legacy functions available to trusted
-- callers and expose one uniquely named server-only entrypoint to the app.
drop function if exists public.consume_rate_limit_server(text, integer, bigint);
create or replace function public.consume_rate_limit_server(
  p_key text,
  p_max_tokens integer,
  p_refill_interval_ms integer
)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.consume_rate_limit(p_key, p_max_tokens, p_refill_interval_ms);
$$;

alter function public.consume_rate_limit_server(text, integer, integer) owner to postgres;
revoke all on function public.consume_rate_limit_server(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit_server(text, integer, integer)
  to service_role;
