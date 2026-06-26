import assert from "node:assert/strict";
import test from "node:test";

import { buildKnockoutBracket } from "../src/bracket.js";

test("buildKnockoutBracket groups knockout matches by tournament round", () => {
  const bracket = buildKnockoutBracket([
    { id: "group", stageName: "First Stage", matchNumber: 1 },
    {
      id: "r32",
      stageName: "Round of 32",
      stage: "Round of 32",
      matchNumber: 73,
      kickoff: "2026-06-28T19:00:00Z",
      homeTeam: { id: "mex", name: "Mexico" },
      awayPlaceholder: "3CEFHI"
    },
    {
      id: "final",
      stageName: "Final",
      stage: "Final",
      matchNumber: 104,
      kickoff: "2026-07-19T19:00:00Z",
      homePlaceholder: "W101",
      awayPlaceholder: "W102"
    }
  ]);

  assert.deepEqual(
    bracket.map((round) => [round.key, round.matches.map((match) => match.id)]),
    [
      ["round-of-32", ["r32"]],
      ["final", ["final"]]
    ]
  );
});

test("buildKnockoutBracket marks finished match winners", () => {
  const bracket = buildKnockoutBracket([
    {
      id: "r32",
      stageName: "Round of 32",
      stage: "Round of 32",
      matchNumber: 73,
      kickoff: "2026-06-28T19:00:00Z",
      homeTeam: { id: "mex", name: "Mexico" },
      awayTeam: { id: "rsa", name: "South Africa" },
      result: {
        homeScore: 2,
        awayScore: 1,
        winnerTeamId: "mex"
      }
    }
  ]);

  const [match] = bracket[0].matches;
  assert.equal(match.status, "finished");
  assert.equal(match.home.isWinner, true);
  assert.equal(match.away.isWinner, false);
  assert.equal(match.score, "2-1");
});

test("buildKnockoutBracket projects unknown knockout placeholders from current standings", () => {
  const teams = [
    team("mex", "Mexico", "Group A", 7, 5, 6),
    team("can", "Canada", "Group A", 4, 1, 3),
    team("rsa", "South Africa", "Group A", 3, 0, 4),
    team("bra", "Brazil", "Group B", 9, 7, 8),
    team("kor", "Korea Republic", "Group B", 7, 3, 6),
    team("jpn", "Japan", "Group B", 6, 2, 5),
    team("sui", "Switzerland", "Group C", 5, 2, 4),
    team("mar", "Morocco", "Group C", 4, 1, 3),
    team("usa", "USA", "Group D", 5, 1, 4)
  ];
  const bracket = buildKnockoutBracket(
    [
      {
        id: "r32",
        stageName: "Round of 32",
        stage: "Round of 32",
        matchNumber: 73,
        kickoff: "2026-06-28T19:00:00Z",
        homePlaceholder: "2A",
        awayPlaceholder: "3ABCDF"
      }
    ],
    teams
  );

  const [match] = bracket[0].matches;
  assert.equal(match.home.label, "Canada");
  assert.equal(match.home.projected, true);
  assert.equal(match.away.label, "Japan");
  assert.equal(match.away.projected, true);
});

function team(id, name, group, points, goalDifference, goalsFor) {
  return {
    id,
    name,
    group,
    currentTournamentStats: {
      played: 3,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor,
      goalsAgainst: goalsFor - goalDifference,
      goalDifference,
      points,
      form: []
    }
  };
}
