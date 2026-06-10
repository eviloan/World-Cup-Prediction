import assert from "node:assert/strict";
import test from "node:test";

import { formatDisplayName, formatMarketValue, formatStat } from "../src/formatters.js";

test("formatDisplayName capitalizes each name segment", () => {
  assert.equal(formatDisplayName("Lionel MESSI"), "Lionel Messi");
  assert.equal(formatDisplayName("GANNON-DOAK"), "Gannon-Doak");
  assert.equal(formatDisplayName("MAC ALLISTER"), "Mac Allister");
});

test("formatStat renders nullish values as 0", () => {
  assert.equal(formatStat(null), "0");
  assert.equal(formatStat(undefined), "0");
  assert.equal(formatStat(7), "7");
});

test("formatMarketValue renders missing values as 0", () => {
  assert.equal(formatMarketValue(null), "0");
  assert.equal(formatMarketValue("€1.20m"), "€1.20m");
});
