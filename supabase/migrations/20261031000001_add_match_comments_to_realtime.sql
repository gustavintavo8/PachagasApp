-- El chat escucha los INSERT de match_comments, pero la tabla no estaba en la publicación
-- y el mensaje no llegaba al resto hasta recargar. Idempotente: en producción puede estar ya.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_comments'
  ) then
    alter publication supabase_realtime add table public.match_comments;
  end if;
end;
$$;
