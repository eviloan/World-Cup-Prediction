import assert from "node:assert/strict";
import test from "node:test";

import { buildPlayerWorldCupStatsData } from "../src/playerWorldCupStatsImport.js";

const teams = {
  mex: {
    id: "mex",
    fifaId: "43911",
    name: "Mexico",
    players: [
      { fifaId: "1", name: "STARTER SCORER" },
      { fifaId: "2", name: "BENCH ASSIST" }
    ]
  },
  rsa: {
    id: "rsa",
    fifaId: "43883",
    name: "South Africa",
    players: [{ fifaId: "3", name: "FULL MATCH" }]
  }
};

test("buildPlayerWorldCupStatsData derives appearances goals assists and minutes from FIFA live data", () => {
  const data = buildPlayerWorldCupStatsData({
    teams,
    liveMatches: [
      {
        IdMatch: "400021443",
        MatchTime: "98'",
        HomeTeam: {
          IdTeam: "43911",
          Players: [
            { IdPlayer: "1", Status: 1, PlayerName: [{ Description: "Starter Scorer" }] },
            { IdPlayer: "2", Status: 2, PlayerName: [{ Description: "Bench Assist" }] }
          ],
          Goals: [{ IdPlayer: "1", IdAssistPlayer: "2", Type: 2 }],
          Substitutions: [{ IdPlayerOff: "1", IdPlayerOn: "2", Minute: "66'" }]
        },
        AwayTeam: {
          IdTeam: "43883",
          Players: [{ IdPlayer: "3", Status: 1, PlayerName: [{ Description: "Full Match" }] }],
          Goals: [],
          Substitutions: []
        }
      }
    ]
  });

  assert.deepEqual(data.playerWorldCupStatsByFifaId["1"].stats, {
    appearances: 1,
    goals: 1,
    assists: 0,
    minutesPlayed: 66
  });
  assert.deepEqual(data.playerWorldCupStatsByFifaId["2"].stats, {
    appearances: 1,
    goals: 0,
    assists: 1,
    minutesPlayed: 32
  });
  assert.equal(data.playerWorldCupStatsByFifaId["3"].stats.minutesPlayed, 98);
  assert.equal(data.goalLeaderboard[0].fifaId, "1");
  assert.equal(data.assistLeaderboard[0].fifaId, "2");
  assert.equal(data.assistsAvailable, true);
});

test("buildPlayerWorldCupStatsData keeps roster players at zero when official match data is absent", () => {
  const data = buildPlayerWorldCupStatsData({ teams, liveMatches: [] });

  assert.deepEqual(data.playerWorldCupStatsByFifaId["1"].stats, {
    appearances: 0,
    goals: 0,
    assists: 0,
    minutesPlayed: 0
  });
  assert.deepEqual(data.goalLeaderboard, []);
  assert.deepEqual(data.assistLeaderboard, []);
  assert.equal(data.assistsAvailable, false);
});
