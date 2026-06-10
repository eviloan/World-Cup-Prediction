import assert from "node:assert/strict";
import test from "node:test";

import { transformFifaData, transformMatch, transformTeam } from "../src/fifaDataTransform.js";

test("transformTeam maps FIFA team and squad fields into app data", () => {
  const team = {
    IdTeam: "43911",
    IdConfederation: "CONCACAF",
    Name: [{ Locale: "en-GB", Description: "Mexico" }],
    Abbreviation: "MEX",
    PictureUrl: "https://api.fifa.com/api/v3/picture/flags-{format}-{size}/MEX"
  };
  const squad = {
    Players: [
      {
        IdPlayer: "485070",
        PlayerName: [{ Locale: "en-GB", Description: "Raul RANGEL" }],
        ShortName: [{ Locale: "en-GB", Description: "R. RANGEL" }],
        JerseyNum: 1,
        Position: 0,
        PositionLocalized: [{ Locale: "en-GB", Description: "Goalkeeper" }],
        PlayerPicture: { PictureUrl: "https://digitalhub.fifa.com/player.jpg" }
      }
    ],
    Officials: [
      {
        Role: 0,
        Alias: [{ Locale: "en-GB", Description: "Javier AGUIRRE" }]
      }
    ]
  };

  const result = transformTeam(team, squad);

  assert.equal(result.id, "mex");
  assert.equal(result.flagUrl, "https://flagcdn.com/mx.svg");
  assert.equal(result.fifaFlagUrl, "https://api.fifa.com/api/v3/picture/flags-png-l/MEX");
  assert.equal(result.coach, "Javier AGUIRRE");
  assert.equal(result.players[0].position, "GK");
  assert.equal(result.players[0].photoUrl, "https://digitalhub.fifa.com/player.jpg");
});

test("transformMatch keeps placeholders when knockout teams are unknown", () => {
  const result = transformMatch({
    IdMatch: "400021543",
    MatchNumber: 104,
    StageName: [{ Locale: "en-GB", Description: "Final" }],
    GroupName: [],
    Date: "2026-07-19T19:00:00Z",
    LocalDate: "2026-07-19T15:00:00Z",
    Stadium: {
      Name: [{ Locale: "en-GB", Description: "New York/New Jersey Stadium" }],
      CityName: [{ Locale: "en-GB", Description: "New Jersey" }]
    },
    Home: null,
    Away: null,
    PlaceHolderA: "W101",
    PlaceHolderB: "W102"
  });

  assert.equal(result.id, "400021543");
  assert.equal(result.homeTeamId, null);
  assert.equal(result.awayTeamId, null);
  assert.equal(result.homePlaceholder, "W101");
  assert.equal(result.venue, "New York/New Jersey Stadium, New Jersey");
});

test("transformFifaData builds team map and sorted match list", () => {
  const result = transformFifaData({
    teamsPayload: {
      Results: [
        {
          IdTeam: "43911",
          IdConfederation: "CONCACAF",
          Name: [{ Locale: "en-GB", Description: "Mexico" }],
          Abbreviation: "MEX"
        }
      ]
    },
    squadsByTeamId: { 43911: { Players: [] } },
    matchesPayload: {
      Results: [
        { IdMatch: "b", MatchNumber: 2, StageName: [], GroupName: [], Home: null, Away: null },
        {
          IdMatch: "a",
          MatchNumber: 1,
          StageName: [],
          GroupName: [{ Locale: "en-GB", Description: "Group A" }],
          Home: { Abbreviation: "MEX" },
          Away: null
        }
      ]
    }
  });

  assert.deepEqual(Object.keys(result.teams), ["mex"]);
  assert.deepEqual(result.matches.map((match) => match.id), ["a", "b"]);
  assert.equal(result.teams.mex.group, "Group A");
});
