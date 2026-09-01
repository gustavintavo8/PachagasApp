import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { isLocalSupabaseUrl } from "../e2e/helpers/local-supabase-url.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");

test("la guardia acepta únicamente URLs de hosts locales explícitos", () => {
    for (const url of [
        "http://127.0.0.1:54321",
        "https://localhost:54321",
        "http://[::1]:54321",
    ]) {
        assert.equal(isLocalSupabaseUrl(url), true, url);
    }
});

test("la guardia rechaza dominios parecidos, remotos o malformados", () => {
    for (const url of [
        "https://127.0.0.1.attacker.example",
        "https://produccion-localhost.example",
        "https://supabase.example.com",
        "ftp://localhost:54321",
        "not-a-url",
    ]) {
        assert.equal(isLocalSupabaseUrl(url), false, url);
    }
});

test("global setup y helpers aplican la misma guardia antes de usar service_role", () => {
    assert.equal(existsSync(resolve(root, "e2e/helpers/local-supabase-url.mjs")), true);

    const globalSetup = read("e2e/global-setup.ts");
    const dbHelpers = read("e2e/helpers/db.ts");

    assert.match(globalSetup, /assertLocalSupabaseUrl\(supabaseUrl\)/);
    assert.match(dbHelpers, /assertLocalSupabaseUrl\(url\)/);
});

test("el spec estacional serializa el estado compartido del usuario regular", () => {
    assert.match(read("e2e/seasons.spec.ts"), /test\.describe\.configure\(\{\s*mode:\s*["']serial["']\s*\}\)/);
});

test("el cleanup gated elimina solo sus estadísticas y su grant", () => {
    const access = read("e2e/access.spec.ts");
    const dbHelpers = read("e2e/helpers/db.ts");

    assert.match(dbHelpers, /export async function deleteSeasonPlayerStats\(userId: string\)/);
    assert.match(dbHelpers, /from\("season_player_stats"\)\.delete\(\)\.eq\("user_id", userId\)/);
    assert.match(access, /deleteSeasonPlayerStats\(gatedUserId\)/);
    assert.match(access, /deleteCommunityGrant\(gatedUserId\)/);
});
