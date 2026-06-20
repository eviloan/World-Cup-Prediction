import assert from "node:assert/strict";
import test from "node:test";

import { canPredictMatch } from "../src/matchPredictionState.js";

test("canPredictMatch allows confirmed upcoming matches", () => {
  assert.equal(
    canPredictMatch({
      homeTeam: { id: "mex" },
      awayTeam: { id: "rsa" }
    }),
    true
  );
});

test("canPredictMatch hides prediction controls for finished matches", () => {
  assert.equal(
    canPredictMatch({
      homeTeam: { id: "mex" },
      awayTeam: { id: "rsa" },
      result: { homeScore: 2, awayScore: 0 }
    }),
    false
  );
});
