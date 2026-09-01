import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");

test("Task 7 keeps guest and Fantasy entry points disabled", () => {
    assert.equal(existsSync(resolve(root, "e2e/guest.spec.ts")), false);

    const navbar = read("src/components/NavbarClient.tsx");
    const bottomNav = read("src/components/BottomNav.tsx");
    assert.doesNotMatch(navbar, /(?:href|label).*Fantasy|\/fantasy/);
    assert.doesNotMatch(bottomNav, /(?:href|label).*Fantasy|\/fantasy/);

    const fantasyLayout = read("src/app/fantasy/layout.tsx");
    assert.match(fantasyLayout, /notFound\(\)/);
    assert.doesNotMatch(fantasyLayout, /createClient|FantasyTabs|children/);
});

test("Task 7 blocks guest backend access and Fantasy AI tools", () => {
    const access = read("src/lib/access.ts");
    assert.match(access, /if \(!user\.id \|\| isGuestUser\(user\)\)/);
    const redeemGuard = access.indexOf("if (authError || !user || isGuestUser(user))");
    const accessCodeCheck = access.indexOf("if (!accessCodeMatches(code))");
    assert.ok(redeemGuard >= 0 && redeemGuard < accessCodeCheck);

    const assistantRoute = read("src/app/api/asistente/route.ts");
    assert.match(assistantRoute, /user\.is_anonymous\s*===\s*true/);

    const aiTools = read("src/lib/ai/tools.ts");
    assert.doesNotMatch(aiTools, /get_fantasy_|fantasy_(?:teams|rosters)/);
});

test("Task 7 Fantasy actions never query or mutate data", () => {
    const fantasyActions = read("src/app/fantasy/actions.ts");
    assert.doesNotMatch(fantasyActions, /createClient|createAdminClient|\.from\(|revalidatePath/);
    assert.match(fantasyActions, /Fantasy está desactivado temporalmente/);

    const matchActions = read("src/app/matches/actions.ts");
    assert.doesNotMatch(matchActions, /applyFantasyPoints|fantasy_(?:teams|rosters)/);
});
