


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_now bigint;
  v_tokens integer;
  v_last_refill bigint;
  v_refill_count integer;
begin
  -- Get current time in milliseconds
  v_now := extract(epoch from now()) * 1000;

  -- Lock the row for update to prevent concurrent race conditions
  select tokens, last_refill into v_tokens, v_last_refill
  from public.rate_limits
  where key = p_key
  for update;

  if not found then
    -- Record doesn't exist, create it with max_tokens - 1
    insert into public.rate_limits (key, tokens, last_refill)
    values (p_key, p_max_tokens - 1, v_now);
    return true;
  end if;

  -- Calculate refill based on elapsed time
  v_refill_count := floor((v_now - v_last_refill) / p_refill_interval_ms) * p_max_tokens;
  
  if v_refill_count > 0 then
    v_tokens := least(p_max_tokens, v_tokens + v_refill_count);
    v_last_refill := v_now;
  end if;

  if v_tokens <= 0 then
    return false;
  end if;

  -- Consume 1 token
  v_tokens := v_tokens - 1;

  update public.rate_limits
  set tokens = v_tokens,
      last_refill = v_last_refill
  where key = p_key;

  return true;
end;
$$;


ALTER FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_now         TIMESTAMPTZ := NOW();
    v_tokens      INTEGER;
    v_last_refill TIMESTAMPTZ;
    v_elapsed_ms  BIGINT;
    v_refilled    INTEGER;
BEGIN
    INSERT INTO rate_limits (key, tokens, last_refill)
    VALUES (p_key, p_max_tokens, v_now)
    ON CONFLICT (key) DO NOTHING;

    SELECT tokens, last_refill
    INTO v_tokens, v_last_refill
    FROM rate_limits
    WHERE key = p_key
    FOR UPDATE;

    v_elapsed_ms := EXTRACT(EPOCH FROM (v_now - v_last_refill)) * 1000;
    v_refilled   := FLOOR(v_elapsed_ms::FLOAT / p_refill_interval_ms * p_max_tokens)::INTEGER;

    IF v_refilled > 0 THEN
        v_tokens      := LEAST(v_tokens + v_refilled, p_max_tokens);
        v_last_refill := v_now;
    END IF;

    IF v_tokens <= 0 THEN
        UPDATE rate_limits SET tokens = v_tokens, last_refill = v_last_refill WHERE key = p_key;
        RETURN FALSE;
    END IF;

    UPDATE rate_limits SET tokens = v_tokens - 1, last_refill = v_last_refill WHERE key = p_key;
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, username, position)
  values (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'MID'
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Si quien hace el UPDATE es un usuario normal (desde la App), bloqueamos cambios en stats
  IF auth.uid() IS NOT NULL THEN
    
    -- Protegemos el ELO
    IF NEW.elo_rating IS DISTINCT FROM OLD.elo_rating THEN
      NEW.elo_rating = OLD.elo_rating;
    END IF;

    -- Protegemos los partidos jugados
    IF NEW.matches_played IS DISTINCT FROM OLD.matches_played THEN
      NEW.matches_played = OLD.matches_played;
    END IF;

    -- Protegemos el valor de mercado del Fantasy
    IF NEW.market_value IS DISTINCT FROM OLD.market_value THEN
      NEW.market_value = OLD.market_value;
    END IF;

  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_profile_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_stats_on_match_finished"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Only act when a match changes to 'finished' exactly now
  if new.status = 'finished' and (old.status is null or old.status != 'finished') then
    
    -- Increment matches_played for all participants
    update public.profiles
    set matches_played = coalesce(matches_played, 0) + 1
    where id in (
      select user_id from public.match_participants where match_id = new.id
    );

    -- Increase goals_scored for goal scorers
    update public.profiles p
    set goals_scored = coalesce(p.goals_scored, 0) + mp.goals
    from public.match_participants mp
    where mp.match_id = new.id
      and mp.user_id = p.id
      and mp.goals > 0;

  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."update_profile_stats_on_match_finished"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."fantasy_rosters" (
    "team_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "is_captain" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_starter" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."fantasy_rosters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fantasy_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "budget" integer DEFAULT 100000000 NOT NULL,
    "total_points" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fantasy_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."match_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_participants" (
    "match_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team" "text",
    "goals" integer DEFAULT 0,
    "is_mvp" boolean DEFAULT false
);


ALTER TABLE "public"."match_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "photo_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."match_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "location" "text",
    "max_players" integer DEFAULT 14,
    "status" "text" DEFAULT 'open'::"text",
    "team_a_score" integer DEFAULT 0,
    "team_b_score" integer DEFAULT 0,
    "created_by" "uuid",
    "finished_at" timestamp with time zone
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mvp_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "voter_id" "uuid" NOT NULL,
    "voted_for" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mvp_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text",
    "title" "text" NOT NULL,
    "message" "text",
    "match_id" "uuid",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "username" "text",
    "avatar_url" "text",
    "position" "text",
    "skill_level" integer DEFAULT 5,
    "matches_played" integer DEFAULT 0,
    "goals_scored" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "elo_rating" integer DEFAULT 1000 NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "market_value" integer DEFAULT 10000000
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "key" "text" NOT NULL,
    "tokens" integer NOT NULL,
    "last_refill" bigint NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rp_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "match_id" "uuid",
    "rp_change" integer NOT NULL,
    "new_rp" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rp_history" OWNER TO "postgres";


ALTER TABLE ONLY "public"."fantasy_rosters"
    ADD CONSTRAINT "fantasy_rosters_pkey" PRIMARY KEY ("team_id", "player_id");



ALTER TABLE ONLY "public"."fantasy_teams"
    ADD CONSTRAINT "fantasy_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fantasy_teams"
    ADD CONSTRAINT "fantasy_teams_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."match_comments"
    ADD CONSTRAINT "match_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_participants"
    ADD CONSTRAINT "match_participants_pkey" PRIMARY KEY ("match_id", "user_id");



ALTER TABLE ONLY "public"."match_photos"
    ADD CONSTRAINT "match_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mvp_votes"
    ADD CONSTRAINT "mvp_votes_match_id_voter_id_key" UNIQUE ("match_id", "voter_id");



ALTER TABLE ONLY "public"."mvp_votes"
    ADD CONSTRAINT "mvp_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."rp_history"
    ADD CONSTRAINT "rp_history_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "enforce_profile_stats_protection" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_stats"();



CREATE OR REPLACE TRIGGER "match_finished_stats_trigger" AFTER UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_stats_on_match_finished"();



ALTER TABLE ONLY "public"."fantasy_rosters"
    ADD CONSTRAINT "fantasy_rosters_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fantasy_rosters"
    ADD CONSTRAINT "fantasy_rosters_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."fantasy_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fantasy_teams"
    ADD CONSTRAINT "fantasy_teams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_comments"
    ADD CONSTRAINT "match_comments_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_comments"
    ADD CONSTRAINT "match_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."match_participants"
    ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_participants"
    ADD CONSTRAINT "match_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."match_photos"
    ADD CONSTRAINT "match_photos_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_photos"
    ADD CONSTRAINT "match_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."mvp_votes"
    ADD CONSTRAINT "mvp_votes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mvp_votes"
    ADD CONSTRAINT "mvp_votes_voted_for_fkey" FOREIGN KEY ("voted_for") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mvp_votes"
    ADD CONSTRAINT "mvp_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rp_history"
    ADD CONSTRAINT "rp_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rp_history"
    ADD CONSTRAINT "rp_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Cualquiera puede leer el chat" ON "public"."match_comments" FOR SELECT USING (true);



CREATE POLICY "Cualquiera puede ver info de fotos" ON "public"."match_photos" FOR SELECT USING (true);



CREATE POLICY "Editar propio perfil" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Gestionar partidos auth" ON "public"."matches" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Permitir lectura de rp_history a todos" ON "public"."rp_history" FOR SELECT USING (true);



CREATE POLICY "Solo el mánager gestiona su plantilla" ON "public"."fantasy_rosters" USING ((EXISTS ( SELECT 1
   FROM "public"."fantasy_teams"
  WHERE (("fantasy_teams"."id" = "fantasy_rosters"."team_id") AND ("fantasy_teams"."user_id" = "auth"."uid"())))));



CREATE POLICY "Solo el mánager puede crear su equipo" ON "public"."fantasy_teams" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Solo el mánager puede editar su equipo" ON "public"."fantasy_teams" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Todos pueden ver las plantillas" ON "public"."fantasy_rosters" FOR SELECT USING (true);



CREATE POLICY "Todos pueden ver los equipos" ON "public"."fantasy_teams" FOR SELECT USING (true);



CREATE POLICY "Unirse a partido auth" ON "public"."match_participants" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can insert their own votes" ON "public"."mvp_votes" FOR INSERT WITH CHECK (("voter_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view votes for matches they participated in" ON "public"."mvp_votes" FOR SELECT USING ((("voter_id" = "auth"."uid"()) OR ("voted_for" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."match_participants"
  WHERE (("match_participants"."match_id" = "mvp_votes"."match_id") AND ("match_participants"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Usuarios actualizan sus propias notificaciones (marcar leídas)" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuarios autenticados crean notificaciones" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Usuarios autenticados escriben" ON "public"."match_comments" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Usuarios autenticados suben info" ON "public"."match_photos" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Usuarios ven sus propias notificaciones" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Ver participantes todos" ON "public"."match_participants" FOR SELECT USING (true);



CREATE POLICY "Ver partidos todos" ON "public"."matches" FOR SELECT USING (true);



CREATE POLICY "Ver perfiles todos" ON "public"."profiles" FOR SELECT USING (true);



ALTER TABLE "public"."fantasy_rosters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fantasy_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matches_delete_owner" ON "public"."matches" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "matches_insert_auth" ON "public"."matches" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "matches_select_public" ON "public"."matches" FOR SELECT USING (true);



CREATE POLICY "matches_update_owner" ON "public"."matches" FOR UPDATE USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



ALTER TABLE "public"."mvp_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mvp_votes_delete_own" ON "public"."mvp_votes" FOR DELETE USING (("auth"."uid"() = "voter_id"));



CREATE POLICY "mvp_votes_insert_own" ON "public"."mvp_votes" FOR INSERT WITH CHECK (("auth"."uid"() = "voter_id"));



CREATE POLICY "mvp_votes_select_public" ON "public"."mvp_votes" FOR SELECT USING (true);



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "participants_delete_own" ON "public"."match_participants" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "participants_insert_own" ON "public"."match_participants" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "participants_select_public" ON "public"."match_participants" FOR SELECT USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_public" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rp_history" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."mvp_votes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_key" "text", "p_max_tokens" integer, "p_refill_interval_ms" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_profile_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_profile_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_profile_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_stats_on_match_finished"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_stats_on_match_finished"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_stats_on_match_finished"() TO "service_role";


















GRANT ALL ON TABLE "public"."fantasy_rosters" TO "anon";
GRANT ALL ON TABLE "public"."fantasy_rosters" TO "authenticated";
GRANT ALL ON TABLE "public"."fantasy_rosters" TO "service_role";



GRANT ALL ON TABLE "public"."fantasy_teams" TO "anon";
GRANT ALL ON TABLE "public"."fantasy_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."fantasy_teams" TO "service_role";



GRANT ALL ON TABLE "public"."match_comments" TO "anon";
GRANT ALL ON TABLE "public"."match_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."match_comments" TO "service_role";



GRANT ALL ON TABLE "public"."match_participants" TO "anon";
GRANT ALL ON TABLE "public"."match_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."match_participants" TO "service_role";



GRANT ALL ON TABLE "public"."match_photos" TO "anon";
GRANT ALL ON TABLE "public"."match_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."match_photos" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."mvp_votes" TO "anon";
GRANT ALL ON TABLE "public"."mvp_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."mvp_votes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."rp_history" TO "anon";
GRANT ALL ON TABLE "public"."rp_history" TO "authenticated";
GRANT ALL ON TABLE "public"."rp_history" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Subir avatares auth"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Subir imágenes de partidos auth"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'match_photos'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Ver avatares todos"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "Ver imágenes de partidos todos"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'match_photos'::text));



