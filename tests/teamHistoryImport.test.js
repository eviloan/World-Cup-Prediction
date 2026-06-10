import assert from "node:assert/strict";
import test from "node:test";

import { buildTeamHistoryData } from "../src/teamHistoryImport.js";

const teams = {
  mex: { id: "mex", name: "Mexico" },
  can: { id: "can", name: "Canada" },
  usa: { id: "usa", name: "USA" }
};

test("buildTeamHistoryData aggregates World Cup record, recent official form, and head-to-head", () => {
  const result = buildTeamHistoryData({
    teams,
    currentMatches: [
      { id: "current-1", homeTeamId: "mex", awayTeamId: "can" }
    ],
    gameRows: [
      worldCup("2018-06-10", "2017", "Group Stage", "Mexico", "Canada", 2, 0),
      worldCup("2022-12-01", "2021", "Quarter-Finals", "Canada", "Mexico", 1, 1),
      official("2025-01-01", "Mexico", "Canada", 3, 1),
      official("2025-02-01", "USA", "Mexico", 0, 2),
      official("2025-03-01", "Canada", "USA", 1, 0),
      friendly("2025-04-01", "Mexico", "Canada", 9, 9)
    ]
  });

  assert.deepEqual(result.teamHistoryByTeamId.mex.worldCupRecord, {
    matches: 2,
    wins: 1,
    draws: 1,
    losses: 0,
    goalsFor: 3,
    goalsAgainst: 1,
    bestStage: "Quarter-Finals"
  });
  assert.deepEqual(result.teamHistoryByTeamId.mex.recentForm.record, {
    matches: 4,
    wins: 3,
    draws: 1,
    losses: 0,
    goalsFor: 8,
    goalsAgainst: 2
  });
  assert.equal(result.teamHistoryByTeamId.mex.recentForm.goalsFor, 8);
  assert.equal(result.teamHistoryByTeamId.mex.recentForm.goalsAgainst, 2);
  assert.equal(result.teamHistoryByTeamId.mex.recentForm.avgGoalsFor, 2);
  assert.equal(result.teamHistoryByTeamId.mex.recentForm.avgGoalsAgainst, 0.5);
  assert.deepEqual(result.teamHistoryByTeamId.mex.headToHead.can, {
    matches: 4,
    wins: 2,
    draws: 2,
    losses: 0,
    goalsFor: 15,
    goalsAgainst: 11
  });
});

function worldCup(date, season, round, home, away, homeGoals, awayGoals) {
  return game(date, "FIWC", season, round, home, away, homeGoals, awayGoals, "national_team_competition");
}

function official(date, home, away, homeGoals, awayGoals) {
  return game(date, "CONL", "2025", "League A", home, away, homeGoals, awayGoals, "national_team_competition");
}

function friendly(date, home, away, homeGoals, awayGoals) {
  return game(date, "FR", "2025", "Friendly", home, away, homeGoals, awayGoals, "friendly");
}

function game(date, competitionId, season, round, home, away, homeGoals, awayGoals, competitionType) {
  return {
    date,
    competition_id: competitionId,
    season,
    round,
    home_club_name: home,
    away_club_name: away,
    home_club_goals: String(homeGoals),
    away_club_goals: String(awayGoals),
    competition_type: competitionType
  };
}
