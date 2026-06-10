import assert from "node:assert/strict";
import test from "node:test";

import { enrichTeamsWithTransfermarkt } from "../src/transfermarktData.js";

test("enrichTeamsWithTransfermarkt merges player market values and stats by FIFA id", () => {
  const teams = [
    {
      id: "mex",
      name: "Mexico",
      players: [
        { fifaId: "356731", name: "Raul Jimenez", club: "" },
        { fifaId: "430759", name: "Santiago Gimenez", club: "" }
      ]
    }
  ];

  const result = enrichTeamsWithTransfermarkt(teams, {
    356731: {
      marketValue: "€1.20m",
      club: "Fulham FC",
      stats: { appearances: 18, goals: 7, assists: 2 },
      transfermarktUrl: "https://www.transfermarkt.co.uk/raul-jimenez/profil/spieler/206040"
    },
    430759: {
      marketValue: "€35.00m",
      club: "AC Milan",
      stats: { appearances: 21, goals: 9, assists: 3 }
    }
  });

  assert.equal(result[0].players[0].club, "Fulham FC");
  assert.equal(result[0].players[0].marketValue, "€1.20m");
  assert.deepEqual(result[0].players[0].stats, {
    appearances: 18,
    goals: 7,
    assists: 2,
    minutesPlayed: null
  });
  assert.equal(result[0].marketValue.amount, 36_200_000);
});
