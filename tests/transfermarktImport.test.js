import assert from "node:assert/strict";
import test from "node:test";

import { buildTransfermarktProfiles, normalizePersonName } from "../src/transfermarktImport.js";

test("normalizePersonName folds case, accents, punctuation and FIFA uppercase surnames", () => {
  assert.equal(normalizePersonName("Raúl JIMÉNEZ"), "raul jimenez");
  assert.equal(normalizePersonName("AIT-NOURI"), "ait nouri");
});

test("buildTransfermarktProfiles matches FIFA players and initializes World Cup stats as zero", () => {
  const teams = {
    mex: {
      name: "Mexico",
      players: [
        {
          fifaId: "356731",
          name: "Raul JIMENEZ",
          birthDate: "1991-05-05T00:00:00Z"
        }
      ]
    }
  };

  const result = buildTransfermarktProfiles({
    teams,
    playerRows: [
      {
        player_id: "206040",
        name: "Raúl Jiménez",
        country_of_citizenship: "Mexico",
        date_of_birth: "1991-05-05 00:00:00",
        current_club_name: "Fulham FC",
        market_value_in_eur: "1200000",
        highest_market_value_in_eur: "50000000",
        url: "https://www.transfermarkt.co.uk/raul-jimenez/profil/spieler/206040"
      }
    ],
    valuationRows: [
      { player_id: "206040", date: "2025-01-01", market_value_in_eur: "1100000" },
      { player_id: "206040", date: "2025-06-01", market_value_in_eur: "1200000" }
    ],
    appearanceRows: [
      { player_id: "206040", goals: "1", assists: "0", minutes_played: "90" },
      { player_id: "206040", goals: "2", assists: "1", minutes_played: "75" }
    ]
  });

  assert.deepEqual(result.playersByFifaId["356731"], {
    transfermarktId: "206040",
    marketValue: { amount: 1_200_000, currency: "EUR" },
    highestMarketValue: { amount: 50_000_000, currency: "EUR" },
    club: "Fulham FC",
    stats: { appearances: 0, goals: 0, assists: 0, minutesPlayed: 0 },
    transfermarktUrl: "https://www.transfermarkt.co.uk/raul-jimenez/profil/spieler/206040"
  });
  assert.equal(result.summary.matchedPlayers, 1);
});
