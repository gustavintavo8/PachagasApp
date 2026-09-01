BEGIN;

-- Fantasy is disabled, but its tables and rows remain recoverable for a future reactivation.
REVOKE ALL ON TABLE public.fantasy_teams FROM anon, authenticated;
REVOKE ALL ON TABLE public.fantasy_rosters FROM anon, authenticated;

-- Remove the base migration's permissive/read and manager-write policies. With no table
-- privileges these roles cannot use the REST API even if an old session still exists.
DROP POLICY IF EXISTS "Solo el mánager gestiona su plantilla" ON public.fantasy_rosters;
DROP POLICY IF EXISTS "Solo el mánager puede crear su equipo" ON public.fantasy_teams;
DROP POLICY IF EXISTS "Solo el mánager puede editar su equipo" ON public.fantasy_teams;
DROP POLICY IF EXISTS "Todos pueden ver las plantillas" ON public.fantasy_rosters;
DROP POLICY IF EXISTS "Todos pueden ver los equipos" ON public.fantasy_teams;

-- Keep an explicit deny policy for these API roles as defense in depth if a later migration
-- accidentally restores table privileges while Fantasy remains disabled.
CREATE POLICY "Fantasy desactivado" ON public.fantasy_teams
    AS RESTRICTIVE
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Fantasy desactivado" ON public.fantasy_rosters
    AS RESTRICTIVE
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- The current Fantasy tables use UUID keys and therefore have no owned sequences. Keep this
-- defensive block for any serial/identity sequence added to either table in the future.
DO $$
DECLARE
    sequence_name text;
BEGIN
    FOR sequence_name IN
        SELECT format('%I.%I', sequence_schema.nspname, sequence_relation.relname)
        FROM pg_class AS sequence_relation
        JOIN pg_namespace AS sequence_schema
            ON sequence_schema.oid = sequence_relation.relnamespace
        JOIN pg_depend AS dependency
            ON dependency.classid = 'pg_class'::regclass
            AND dependency.objid = sequence_relation.oid
            AND dependency.refclassid = 'pg_class'::regclass
            AND dependency.deptype IN ('a', 'i')
        JOIN pg_class AS table_relation
            ON table_relation.oid = dependency.refobjid
        WHERE sequence_relation.relkind = 'S'
          AND table_relation.relnamespace = 'public'::regnamespace
          AND table_relation.relname IN ('fantasy_teams', 'fantasy_rosters')
    LOOP
        EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', sequence_name);
    END LOOP;
END;
$$;

-- There are no Fantasy RPC functions in the current schema. Revoke any function that has a
-- catalog dependency on these tables so a future exposed RPC cannot bypass the feature flag.
DO $$
DECLARE
    function_name text;
BEGIN
    FOR function_name IN
        SELECT format(
            '%I.%I(%s)',
            function_schema.nspname,
            function_relation.proname,
            pg_get_function_identity_arguments(function_relation.oid)
        )
        FROM pg_proc AS function_relation
        JOIN pg_namespace AS function_schema
            ON function_schema.oid = function_relation.pronamespace
        JOIN pg_depend AS dependency
            ON dependency.classid = 'pg_proc'::regclass
            AND dependency.objid = function_relation.oid
            AND dependency.refclassid = 'pg_class'::regclass
        JOIN pg_class AS table_relation
            ON table_relation.oid = dependency.refobjid
        WHERE function_relation.prokind = 'f'
          AND table_relation.relnamespace = 'public'::regnamespace
          AND table_relation.relname IN ('fantasy_teams', 'fantasy_rosters')
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', function_name);
    END LOOP;
END;
$$;

COMMIT;
