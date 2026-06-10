import assert from "node:assert/strict";
import test from "node:test";

import { formatOddsValue, getMatchOdds, WORLD_CUP_ODDS_URL } from "../src/odds.js";

test("getMatchOdds returns World Cup odds placeholders without inventing odds", () => {
  const odds = getMatchOdds({
    id: "unknown",
    homeTeam: { name: "Mexico" },
    awayTeam: { name: "South Africa" }
  });

  assert.equal(odds.source, "World Cup Odds");
  assert.equal(odds.sourceUrl, WORLD_CUP_ODDS_URL);
  assert.equal(odds.status, "pending");
  assert.deepEqual(
    odds.selections.map((selection) => selection.value),
    [null, null, null]
  );
});

test("getMatchOdds returns synced wc-2026 match odds when available", () => {
  const odds = getMatchOdds({
    id: "400021443",
    homeTeam: { name: "Mexico" },
    awayTeam: { name: "South Africa" }
  });

  assert.equal(odds.status, "available");
  assert.equal(odds.updatedText, "更新于 2 小时 前");
  assert.deepEqual(
    odds.selections.map((selection) => selection.value),
    ["1.42", "4.65", "8.90"]
  );
});

test("formatOddsValue renders available odds with two decimals", () => {
  assert.equal(formatOddsValue("1.8"), "1.80");
  assert.equal(formatOddsValue(3.45), "3.45");
  assert.equal(formatOddsValue(null), "待同步");
});
