import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

function read(relativePath) {
    return readFileSync(resolve(root, relativePath), "utf8");
}

function readTree(relativePath) {
    const directory = resolve(root, relativePath);
    return readdirSync(directory, { withFileTypes: true })
        .map((entry) => {
            const entryPath = resolve(directory, entry.name);
            return entry.isDirectory()
                ? readTree(`${relativePath}/${entry.name}`)
                : statSync(entryPath).isFile()
                    ? readFileSync(entryPath, "utf8")
                    : "";
        })
        .join("\n");
}

const migrationPath =
    "supabase/migrations/20260901000003_harden_public_rpc_security.sql";

test("cierra get_common_matches para los roles de la Data API y lo cubre el contrato", () => {
    const migration = read(migrationPath);
    const source = readTree("src");
    const verifier = read("src/scripts/verify-season-migration.ts");

    assert.match(
        migration,
        /revoke\s+all\s+on\s+function\s+public\.get_common_matches\(uuid\s*,\s*uuid\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;/i
    );
    assert.match(
        migration,
        /grant\s+execute\s+on\s+function\s+public\.get_common_matches\(uuid\s*,\s*uuid\)\s+to\s+service_role\s*;/i
    );
    assert.match(migration, /verify_public_rpc_security_contract/i);
    assert.match(
        verifier,
        /rpc\(\s*["']verify_public_rpc_security_contract["']/i
    );
    assert.match(
        migration,
        /has_function_privilege\(\s*'anon'\s*,\s*'public\.get_common_matches\(uuid,uuid\)'\s*,\s*'EXECUTE'\s*\)/i
    );
    assert.doesNotMatch(source, /get_common_matches/i);
});

test("revoca las dos sobrecargas públicas de consume_rate_limit y cubre rate_limits", () => {
    const migration = read(migrationPath);
    const signatures = [
        "text, integer, integer",
        "text, integer, bigint",
    ];

    for (const signature of signatures) {
        const escapedSignature = signature.replaceAll(" ", "\\s*");
        const privilegePattern = signature.endsWith("bigint")
            ? new RegExp(
                `execute\\s+['"]revoke\\s+all\\s+on\\s+function\\s+public\\.consume_rate_limit\\(${escapedSignature}\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated['"]`,
                "i"
            )
            : new RegExp(
                `revoke\\s+all\\s+on\\s+function\\s+public\\.consume_rate_limit\\(${escapedSignature}\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
                "i"
            );
        const grantPattern = signature.endsWith("bigint")
            ? new RegExp(
                `execute\\s+['"]grant\\s+execute\\s+on\\s+function\\s+public\\.consume_rate_limit\\(${escapedSignature}\\)\\s+to\\s+service_role['"]`,
                "i"
            )
            : new RegExp(
                `grant\\s+execute\\s+on\\s+function\\s+public\\.consume_rate_limit\\(${escapedSignature}\\)\\s+to\\s+service_role\\s*;`,
                "i"
            );
        assert.match(migration, privilegePattern);
        assert.match(migration, grantPattern);
    }

    assert.match(migration, /rate_limits/i);
    assert.match(
        migration,
        /has_function_privilege\(\s*'service_role'\s*,\s*'public\.consume_rate_limit\(text,integer,integer\)'\s*,\s*'EXECUTE'\s*\)/i
    );
});

test("mantiene la policy de community_access_grants limitada a la fila propia", () => {
    const migration = read(migrationPath);
    const policyStart = migration.indexOf(
        'create policy "access grants select own"'
    );
    assert.notEqual(policyStart, -1);
    const policyBlock = migration.slice(policyStart, policyStart + 300);

    assert.match(
        policyBlock,
        /for\s+select\s+to\s+authenticated[\s\S]*using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i
    );
    assert.doesNotMatch(policyBlock, /private\.has_community_access/i);
});

test("aplica rate limit por usuario antes de comparar el código y conserva un error genérico", () => {
    const source = read("src/lib/access.ts");
    const redeemStart = source.indexOf(
        "export async function redeemAccessCode"
    );
    const redeemSource = source.slice(redeemStart);
    const guardIndex = redeemSource.indexOf("isGuestUser(user)");
    const comparisonIndex = redeemSource.indexOf("accessCodeMatches(code)");
    const beforeComparison = redeemSource.slice(guardIndex, comparisonIndex);

    assert.match(source, /import\s+\{\s*rateLimit\s*\}\s+from\s+["']@\/lib\/rate-limit["']/);
    assert.ok(guardIndex >= 0);
    assert.ok(comparisonIndex > guardIndex);
    assert.match(
        beforeComparison,
        /rateLimit\(\s*`redeem-community-access:\$\{user\.id\}`\s*,\s*5\s*,\s*60_000\s*\)/
    );
    assert.match(
        beforeComparison,
        /if\s*\(!allowed\)[\s\S]{0,180}COMMUNITY_ACCESS_REDEEM_ERROR/
    );
    assert.match(redeemSource, /isGuestUser\(user\)/);
    assert.doesNotMatch(
        redeemSource,
        /console\.(?:log|warn|error)\([\s\S]{0,120}(?:code|accessCode)/i
    );
});

test("mide el popover con un callback ref sin setState síncrono en un effect", () => {
    const source = read("src/components/SoccerPitch.tsx");

    assert.doesNotMatch(source, /useLayoutEffect/);
    assert.match(source, /useCallback/);
    assert.match(source, /setAdjustedPos\(\(current\)/);
});
