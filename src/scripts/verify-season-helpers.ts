import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isSeasonSlug, normalizeAccessCode } from "../lib/season-validation";

assert.equal(isSeasonSlug("season-2"), true);
assert.equal(isSeasonSlug("season-0"), false);
assert.equal(normalizeAccessCode("  PACHANGA  "), "PACHANGA");

const accessSource = readFileSync(new URL("../lib/access.ts", import.meta.url), "utf8");
const provisioningIndex = accessSource.indexOf(
    "const activeSeason = await getActiveSeason();"
);
const statsIndex = accessSource.indexOf(
    "await ensureSeasonPlayerStats(activeSeason.id, user.id);"
);
const grantIndex = accessSource.indexOf(
    '.from("community_access_grants").upsert('
);

assert.equal(accessSource.includes("isGuestUser"), false);
assert.ok(provisioningIndex >= 0);
assert.ok(statsIndex > provisioningIndex);
assert.ok(grantIndex > statsIndex);

console.log("season helper contracts verified");
