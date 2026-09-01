import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

function read(relativePath) {
    return readFileSync(resolve(root, relativePath), "utf8");
}

test("el contrato RLS no depende del esquema descalificado en pg_policies.qual", () => {
    const migration = read(
        "supabase/migrations/20260901000004_fix_rls_contract_qualification.sql"
    );

    assert.match(migration, /p\.qual\s+ilike\s+'%has_community_access\(\)%'/i);
    assert.doesNotMatch(
        migration,
        /p\.qual\s+ilike\s+'%private\.has_community_access%'/i
    );
    assert.match(migration, /create or replace function public\.verify_private_access_rls_contract/i);
});
