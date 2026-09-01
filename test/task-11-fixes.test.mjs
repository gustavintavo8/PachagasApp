import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");

test("C1 añade aislamiento comunitario RLS y contrato de privilegios", () => {
    const migration = read("supabase/migrations/20260901000002_enforce_private_access_rls.sql");

    assert.match(migration, /create schema if not exists private/i);
    assert.match(migration, /create or replace function private\.has_community_access\(\)/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path\s*=\s*pg_catalog,\s*public,\s*auth/i);
    assert.match(migration, /row_security\s*=\s*off/i);
    assert.match(migration, /community_access_grants[\s\S]*revoked_at is null/i);
    assert.match(migration, /profiles[\s\S]*is_admin/i);
    assert.match(migration, /as restrictive/i);
    assert.match(migration, /private\.has_community_access\(\)/i);
    assert.match(migration, /revoke all on table public\.matches from anon/i);
    assert.match(migration, /revoke all on table public\.match_participants from anon/i);
    assert.match(migration, /revoke all on table public\.profiles from anon/i);
    assert.match(migration, /revoke all on table public\.match_photos from anon/i);
    assert.match(migration, /revoke all on table public\.match_comments from anon/i);
    assert.match(migration, /revoke all on table public\.season_player_stats from anon/i);
    assert.match(migration, /revoke all on table public\.rp_history from anon/i);
    assert.match(migration, /verify_private_access_rls_contract/i);
    assert.doesNotMatch(migration, /\b(drop table|truncate|delete from)\b/i);
});

test("C1 no deja lectura propia residual y el middleware usa el RPC seguro", () => {
    const migration = read("supabase/migrations/20260901000002_enforce_private_access_rls.sql");
    const middleware = read("src/middleware.ts");

    assert.match(migration, /current_user_has_community_access/i);
    assert.doesNotMatch(migration, /community access required[\s\S]{0,500}auth\.uid\(\)\s*=\s*id/i);
    assert.match(middleware, /rpc\(\s*["']current_user_has_community_access["']/);
    assert.doesNotMatch(middleware, /from\("community_access_grants"\)|from\("profiles"\)/);
});

test("I1 e I3 no dejan una sincronización de perfiles fuera del RPC final", () => {
    const actions = read("src/app/matches/actions.ts");

    assert.doesNotMatch(actions, /syncLegacyProfileStats/);
    assert.doesNotMatch(actions, /\.from\("profiles"\)\s*\.update\([\s\S]{0,180}(?:matches_played|goals_scored)/);

    const rpcIndex = actions.indexOf('rpc(\n            "finalize_match_with_elo"');
    assert.ok(rpcIndex >= 0, "La finalización debe usar el RPC transaccional");
    const catchIndex = actions.indexOf("    } catch", rpcIndex);
    assert.ok(catchIndex > rpcIndex, "La finalización debe manejar el resultado del RPC");
    assert.doesNotMatch(actions.slice(rpcIndex, catchIndex), /syncLegacyProfileStats|profiles/);

    const atomicMigration = read("supabase/migrations/20260831000003_fix_season_finalization_atomicity.sql");
    assert.match(atomicMigration, /update public\.matches[\s\S]*status = 'finished'/i);
    assert.match(atomicMigration, /insert into public\.rp_history[\s\S]*season_id/i);
});

test("I2 conserva el algoritmo histórico aprobado y el alcance estacional", () => {
    const script = read("src/scripts/recalculate-elo.ts");

    assert.match(script, /K_FACTOR\s*=\s*30/);
    assert.match(script, /K_FACTOR_NEW\s*=\s*60/);
    assert.match(script, /MAX_CHANGE_PER_MATCH\s*=\s*50/);
    assert.match(script, /SCALE_FACTOR\s*=\s*2\.5/);
    assert.match(script, /Math\.round\(ELO_BASE \+ \(raw - ELO_BASE\) \* SCALE_FACTOR\)/);
    assert.doesNotMatch(script, /import .*computeMatchEloUpdates/);
    assert.match(script, /\.eq\("season_id", season\.id\)/);
    assert.match(script, /\.delete\(\)[\s\S]*\.eq\("season_id", season\.id\)/);
    assert.doesNotMatch(script, /\.delete\(\)[\s\S]*\.neq\(['"]id['"]/);
    assert.doesNotMatch(script, /\.from\("profiles"\)\s*\.update\(/);
});

test("I4 compara contadores heredados con el agregado crudo y los reporta", () => {
    const verifier = read("src/scripts/verify-season-migration.ts");

    assert.match(verifier, /legacyCounterDiscrepancies/);
    assert.match(verifier, /raw\.matches_played/);
    assert.match(verifier, /profile\.matches_played/);
    assert.match(verifier, /coherentWithRawMatchAggregate/);
    assert.match(verifier, /console\.log\(JSON\.stringify\([\s\S]*legacyCounterDiscrepancies/);
});

test("M1 resuelve jugadores desde stats de la temporada y rechaza ambigüedad", () => {
    const tools = read("src/lib/ai/tools.ts");
    const historyStart = tools.indexOf("get_players_history_together");
    assert.ok(historyStart >= 0);
    const resolverStart = tools.indexOf("async function resolveSeasonalPlayer");
    assert.ok(resolverStart >= 0);
    const history = tools.slice(resolverStart, historyStart + 5000);

    assert.match(history, /from\("season_player_stats"\)/);
    assert.match(history, /\.eq\("season_id", season\.id\)/);
    assert.match(history, /\.order\("elo_rating", \{ ascending: false \}\)/);
    assert.match(history, /length\s*!==\s*1|length\s*===\s*0/);
    assert.doesNotMatch(history, /from\("profiles"\)[\s\S]*order\("elo_rating"/);
});
