import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

function read(relativePath) {
    return readFileSync(resolve(root, relativePath), "utf8");
}

test("rate-limit usa un RPC único y privado para evitar ambigüedad de overloads", () => {
    const migration = read(
        "supabase/migrations/20260901000005_add_unambiguous_rate_limit_rpc.sql"
    );
    const source = read("src/lib/rate-limit.ts");

    assert.match(migration, /create or replace function public\.consume_rate_limit_server\(/i);
    assert.match(
        migration,
        /revoke\s+all\s+on\s+function\s+public\.consume_rate_limit_server\([^)]*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;/i
    );
    assert.match(
        migration,
        /grant\s+execute\s+on\s+function\s+public\.consume_rate_limit_server\([^)]*\)\s+to\s+service_role\s*;/i
    );
    assert.match(source, /rpc\(\s*["']consume_rate_limit_server["']/i);
    assert.doesNotMatch(source, /rpc\(\s*["']consume_rate_limit["']/i);
});

test("middleware devuelve 404 para cualquier ruta Fantasy deshabilitada", () => {
    const middleware = read("src/middleware.ts");

    assert.match(
        middleware,
        /pathname\s*===\s*["']\/fantasy["'][\s\S]{0,120}pathname\.startsWith\(["']\/fantasy\/["']\)/i
    );
    assert.match(middleware, /new\s+NextResponse\([\s\S]{0,120}status:\s*404/i);
});
