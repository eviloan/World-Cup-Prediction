import assert from "node:assert/strict";
import test from "node:test";

import { nextUpcomingMatchId } from "../src/matchSelection.js";

test("nextUpcomingMatchId selects the nearest unplayed match after now", () => {
  const matches = [
    { id: "finished", kickoff: "2026-06-24T02:00:00Z", result: { homeScore: 1, awayScore: 0 } },
    { id: "later", kickoff: "2026-06-25T02:00:00Z" },
    { id: "next", kickoff: "2026-06-24T18:00:00Z" }
  ];

  assert.equal(nextUpcomingMatchId(matches, new Date("2026-06-24T08:00:00Z")), "next");
});

test("nextUpcomingMatchId returns null when every match is finished or already started", () => {
  const matches = [
    { id: "past", kickoff: "2026-06-24T02:00:00Z" },
    { id: "finished", kickoff: "2026-06-24T18:00:00Z", result: { homeScore: 1, awayScore: 0 } }
  ];

  assert.equal(nextUpcomingMatchId(matches, new Date("2026-06-24T20:00:00Z")), null);
});
