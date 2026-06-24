import assert from "node:assert/strict";
import test from "node:test";

import { groupMatchesByDate, toggleFavoriteMatch } from "../src/matchSchedule.js";

test("groupMatchesByDate splits and sorts matches by Beijing date and time", () => {
  const groups = groupMatchesByDate([
    { id: "late", kickoff: "2026-06-11T23:00:00Z" },
    { id: "early", kickoff: "2026-06-11T16:00:00Z" },
    { id: "next-day", kickoff: "2026-06-12T20:00:00Z" }
  ]);

  assert.deepEqual(
    groups.map((group) => [group.key, group.matches.map((match) => match.id)]),
    [
      ["2026-06-12", ["early", "late"]],
      ["2026-06-13", ["next-day"]]
    ]
  );
});

test("toggleFavoriteMatch adds and removes a match id without mutating the original set", () => {
  const original = new Set(["1"]);
  const added = toggleFavoriteMatch(original, "2");
  const removed = toggleFavoriteMatch(added, "1");

  assert.deepEqual([...original], ["1"]);
  assert.deepEqual([...added].sort(), ["1", "2"]);
  assert.deepEqual([...removed], ["2"]);
});
