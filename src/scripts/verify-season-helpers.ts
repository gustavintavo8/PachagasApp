import assert from "node:assert/strict";

import { isSeasonSlug, normalizeAccessCode } from "../lib/season-validation";

assert.equal(isSeasonSlug("season-2"), true);
assert.equal(isSeasonSlug("season-0"), false);
assert.equal(normalizeAccessCode("  PACHANGA  "), "PACHANGA");

console.log("season helper contracts verified");
