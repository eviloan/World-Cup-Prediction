import assert from "node:assert/strict";
import test from "node:test";

import { applyTeamRatings, estimateTeamRatingInputs } from "../src/teamRatings.js";

test("applyTeamRatings maps FIFA ranking rows by team code", () => {
  const teams = {
    mex: { id: "mex", name: "Mexico", players: [] },
    bra: { id: "bra", name: "Brazil", players: [] }
  };

  const result = applyTeamRatings(teams, [
    { IdCountry: "BRA", Rank: 6, RankingMovement: 0 },
    { IdCountry: "MEX", Rank: 15, RankingMovement: 1 }
  ]);

  assert.equal(result.mex.fifaRank, 15);
  assert.equal(result.bra.fifaRank, 6);
});

test("estimateTeamRatingInputs weighs attacker and defender market value by position", () => {
  const team = {
    id: "sample",
    players: [
      { fifaId: "1", position: "FW" },
      { fifaId: "2", position: "MF" },
      { fifaId: "3", position: "DF" },
      { fifaId: "4", position: "GK" }
    ]
  };

  const inputs = estimateTeamRatingInputs(team, {
    1: { marketValue: { amount: 90_000_000, currency: "EUR" } },
    2: { marketValue: { amount: 40_000_000, currency: "EUR" } },
    3: { marketValue: { amount: 8_000_000, currency: "EUR" } },
    4: { marketValue: { amount: 2_000_000, currency: "EUR" } }
  });

  assert.equal(inputs.squadValue, 140_000_000);
  assert.equal(inputs.attackValue, 108_000_000);
  assert.equal(inputs.defenseValue, 20_000_000);
});

test("applyTeamRatings estimates varied attack, defense, and form from Transfermarkt data", () => {
  const teams = {
    attackland: {
      id: "attackland",
      name: "Attackland",
      players: [
        { fifaId: "a1", position: "FW" },
        { fifaId: "a2", position: "MF" },
        { fifaId: "a3", position: "DF" },
        { fifaId: "a4", position: "GK" }
      ]
    },
    defensia: {
      id: "defensia",
      name: "Defensia",
      players: [
        { fifaId: "d1", position: "FW" },
        { fifaId: "d2", position: "MF" },
        { fifaId: "d3", position: "DF" },
        { fifaId: "d4", position: "GK" }
      ]
    }
  };

  const result = applyTeamRatings(
    teams,
    [
      { IdCountry: "ATTACKLAND", TeamName: [{ Description: "Attackland" }], Rank: 10, RankingMovement: 2 },
      { IdCountry: "DEFENSIA", TeamName: [{ Description: "Defensia" }], Rank: 50, RankingMovement: -1 }
    ],
    {
      a1: { marketValue: { amount: 90_000_000, currency: "EUR" } },
      a2: { marketValue: { amount: 40_000_000, currency: "EUR" } },
      a3: { marketValue: { amount: 5_000_000, currency: "EUR" } },
      a4: { marketValue: { amount: 1_000_000, currency: "EUR" } },
      d1: { marketValue: { amount: 5_000_000, currency: "EUR" } },
      d2: { marketValue: { amount: 20_000_000, currency: "EUR" } },
      d3: { marketValue: { amount: 90_000_000, currency: "EUR" } },
      d4: { marketValue: { amount: 25_000_000, currency: "EUR" } }
    }
  );

  assert.ok(result.attackland.attack > result.attackland.defense);
  assert.ok(result.defensia.defense > result.defensia.attack);
  assert.notEqual(result.attackland.form, 72);
  assert.notEqual(result.defensia.form, 72);
});
