import assert from "node:assert/strict";
import test from "node:test";

import { buildGroupStandings } from "../src/standings.js";

test("buildGroupStandings groups teams and sorts by points, goal difference, goals for", () => {
  const groups = buildGroupStandings([
    {
      id: "a",
      name: "Alpha",
      group: "Group A",
      currentTournamentStats: { played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 3, goalsAgainst: 1, goalDifference: 2, points: 4, form: ["W", "D"] }
    },
    {
      id: "b",
      name: "Beta",
      group: "Group A",
      currentTournamentStats: { played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 4, goalsAgainst: 2, goalDifference: 2, points: 4, form: ["D", "W"] }
    },
    {
      id: "c",
      name: "Core",
      group: "Group A",
      currentTournamentStats: { played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 2, goalDifference: 0, points: 3, form: ["W", "L"] }
    }
  ]);

  assert.deepEqual(
    groups[0].teams.map((team) => team.id),
    ["b", "a", "c"]
  );
});

test("buildGroupStandings fills missing tournament stats with zeroes", () => {
  const groups = buildGroupStandings([{ id: "mex", name: "Mexico", group: "Group A" }]);

  assert.deepEqual(groups[0].teams[0].standings, {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  });
});
