import assert from "node:assert/strict";
import test from "node:test";

import { groupPlayersByPosition, sortPlayersByPosition } from "../src/roster.js";

test("sortPlayersByPosition orders players by GK, DF, MF, FW and jersey number", () => {
  const players = [
    { name: "Forward", position: "FW", jerseyNumber: 9 },
    { name: "Defender Two", position: "DF", jerseyNumber: 4 },
    { name: "Goalkeeper", position: "GK", jerseyNumber: 1 },
    { name: "Midfielder", position: "MF", jerseyNumber: 8 },
    { name: "Defender One", position: "DF", jerseyNumber: 2 }
  ];

  const result = sortPlayersByPosition(players);

  assert.deepEqual(
    result.map((player) => player.name),
    ["Goalkeeper", "Defender One", "Defender Two", "Midfielder", "Forward"]
  );
  assert.notEqual(result, players);
});

test("groupPlayersByPosition splits players into ordered position sections", () => {
  const players = [
    { name: "Forward", position: "FW", jerseyNumber: 9 },
    { name: "Goalkeeper", position: "GK", jerseyNumber: 1 },
    { name: "Midfielder", position: "MF", jerseyNumber: 8 },
    { name: "Defender", position: "DF", jerseyNumber: 4 }
  ];

  const result = groupPlayersByPosition(players);

  assert.deepEqual(
    result.map((group) => [group.label, group.players.map((player) => player.name)]),
    [
      ["守门员", ["Goalkeeper"]],
      ["后卫", ["Defender"]],
      ["中场", ["Midfielder"]],
      ["前锋", ["Forward"]]
    ]
  );
});
