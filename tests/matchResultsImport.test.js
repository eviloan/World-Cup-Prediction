import assert from "node:assert/strict";
import test from "node:test";

import { buildMatchResultsData } from "../src/matchResultsImport.js";

const teams = {
  mex: { id: "mex", fifaId: "43911", name: "Mexico" },
  rsa: { id: "rsa", fifaId: "43883", name: "South Africa" },
  kor: { id: "kor", fifaId: "43822", name: "Korea Republic" }
};

test("buildMatchResultsData extracts finished match scores", () => {
  const data = buildMatchResultsData({
    teams,
    matchesPayload: {
      Results: [
        {
          IdMatch: "400021443",
          MatchNumber: 1,
          Date: "2026-06-11T19:00:00Z",
          HomeTeamScore: 2,
          AwayTeamScore: 0,
          Winner: "43911",
          MatchTime: "98'",
          Attendance: "80824",
          Home: { IdTeam: "43911", Abbreviation: "MEX", ShortClubName: "Mexico" },
          Away: { IdTeam: "43883", Abbreviation: "RSA", ShortClubName: "South Africa" }
        }
      ]
    }
  });

  assert.deepEqual(data.matchResultsById["400021443"], {
    matchId: "400021443",
    matchNumber: 1,
    kickoff: "2026-06-11T19:00:00Z",
    status: "finished",
    homeTeamId: "mex",
    awayTeamId: "rsa",
    homeScore: 2,
    awayScore: 0,
    winnerTeamId: "mex",
    matchTime: "98'",
    attendance: 80824
  });
});

test("buildMatchResultsData aggregates current tournament team stats", () => {
  const data = buildMatchResultsData({
    teams,
    matchesPayload: {
      Results: [
        {
          IdMatch: "1",
          HomeTeamScore: 2,
          AwayTeamScore: 0,
          Winner: "43911",
          Home: { IdTeam: "43911", Abbreviation: "MEX" },
          Away: { IdTeam: "43883", Abbreviation: "RSA" }
        },
        {
          IdMatch: "2",
          HomeTeamScore: 1,
          AwayTeamScore: 1,
          Winner: "",
          Home: { IdTeam: "43883", Abbreviation: "RSA" },
          Away: { IdTeam: "43822", Abbreviation: "KOR" }
        }
      ]
    }
  });

  assert.deepEqual(data.teamTournamentStatsById.mex, {
    played: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    goalsFor: 2,
    goalsAgainst: 0,
    goalDifference: 2,
    points: 3,
    form: ["W"]
  });
  assert.deepEqual(data.teamTournamentStatsById.rsa, {
    played: 2,
    wins: 0,
    draws: 1,
    losses: 1,
    goalsFor: 1,
    goalsAgainst: 3,
    goalDifference: -2,
    points: 1,
    form: ["L", "D"]
  });
});

test("buildMatchResultsData ignores future placeholder scores", () => {
  const data = buildMatchResultsData({
    teams,
    asOfDate: new Date("2026-06-20T08:00:00Z"),
    matchesPayload: {
      Results: [
        {
          IdMatch: "future",
          Date: "2026-06-25T01:00:00Z",
          HomeTeamScore: 0,
          AwayTeamScore: 0,
          Home: { IdTeam: "43911", Abbreviation: "MEX" },
          Away: { IdTeam: "43883", Abbreviation: "RSA" }
        }
      ]
    }
  });

  assert.deepEqual(data.matchResultsById, {});
  assert.deepEqual(data.teamTournamentStatsById, {});
});
