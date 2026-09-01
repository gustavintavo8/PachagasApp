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
    const fantasyGuard = middleware.indexOf("const isFantasyRoute");
    const supabaseClient = middleware.indexOf("const supabase = createServerClient");

    assert.match(
        middleware,
        /isFantasyRoute\s*=\s*pathname\s*===\s*["']\/fantasy["'][\s\S]{0,120}pathname\.startsWith\(["']\/fantasy\/["']\)/i
    );
    assert.match(middleware, /new\s+NextResponse\([\s\S]{0,120}status:\s*404/i);
    assert.ok(fantasyGuard > 0 && fantasyGuard < supabaseClient);
});

test("el verificador RLS valida la policy restrictiva completa", () => {
    const migration = read(
        "supabase/migrations/20260901000006_harden_rls_contract_checks.sql"
    );

    assert.match(migration, /p\.permissive\s*=\s*'RESTRICTIVE'/i);
    assert.match(migration, /p\.cmd\s*=\s*'ALL'/i);
    assert.match(migration, /p\.roles\s*=\s*array\s*\[\s*'authenticated'::name\s*\]/i);
    assert.match(migration, /coalesce\(p\.qual,\s*['"]['"]\)\s*~\s*['"][^'"]*has_community_access/i);
    assert.match(migration, /coalesce\(p\.with_check,\s*['"]['"]\)\s*~\s*['"][^'"]*has_community_access/i);
});

test("el contrato RLS comprueba el OID exacto del helper en ambas expresiones", () => {
    const migration = read(
        "supabase/migrations/20260901000007_match_rls_helper_dependencies.sql"
    );

    assert.match(migration, /pg_policy\s+pol/i);
    assert.match(migration, /pol\.polqual::text\s*~/i);
    assert.match(migration, /pol\.polwithcheck::text\s*~/i);
    assert.match(migration, /private\.has_community_access\(\)['"]?::regprocedure/i);
    assert.match(migration, /:funcid\s+%s/i);
});

test("rate-limit falla cerrado cuando el RPC no está disponible", () => {
    const source = read("src/lib/rate-limit.ts");

    assert.doesNotMatch(source, /return\s+\{\s*allowed:\s*true[\s\S]{0,80}remaining/);
    assert.match(source, /return\s+\{\s*allowed:\s*false\s*,\s*remaining:\s*0\s*\}/);
});

test("el callback OAuth espera la persistencia diferida de la sesión", () => {
    const callback = read("src/app/auth/callback/route.ts");
    const exchangeIndex = callback.indexOf("exchangeCodeForSession(code)");
    const persistenceWaitIndex = callback.indexOf("setTimeout", exchangeIndex);

    assert.ok(exchangeIndex >= 0, "El callback debe intercambiar el código OAuth");
    assert.ok(
        persistenceWaitIndex > exchangeIndex,
        "El callback debe esperar después del intercambio OAuth"
    );
    assert.match(
        callback.slice(exchangeIndex, persistenceWaitIndex + 200),
        /await\s+new\s+Promise\s*\(\s*\(resolve\)\s*=>\s*setTimeout\(resolve\s*,\s*0\)/i
    );
});

test("OAuth se inicia en el navegador para conservar el verificador PKCE", () => {
    const loginPage = read("src/app/login/page.tsx");

    assert.match(loginPage, /@\/lib\/supabase\/client/);
    assert.match(loginPage, /supabase\.auth\.signInWithOAuth\(/);
    assert.match(loginPage, /window\.location\.origin/);
    assert.match(loginPage, /skipBrowserRedirect:\s*true/);
    assert.doesNotMatch(loginPage, /signInWithOAuth\(provider\)/);
});

test("las redirecciones al login no conservan códigos OAuth en la query", () => {
    const middleware = read("src/middleware.ts");

    assert.match(
        middleware,
        /if\s*\(\s*pathname\s*===\s*["']\/login["']\s*\)\s*\{[\s\S]{0,100}?url\.search\s*=\s*["']["']/i
    );
});
