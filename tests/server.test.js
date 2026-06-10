import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../server.js";
import { matches } from "../src/data.js";

test("POST /api/predict returns a prediction for a known match", async () => {
  const server = createServer({ kimiApiKey: "" });
  const confirmedMatch = matches.find((match) => match.homeTeamId && match.awayTeamId);

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: confirmedMatch.id,
        rules: "主队有揭幕战压力，比分不要过大"
      })
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.match, undefined);
    assert.equal(body.prediction.source, "local-rules");
    assert.equal(body.prediction.scoreOptions.length, 3);
    assert.equal(
      body.prediction.probabilities.homeWin +
        body.prediction.probabilities.draw +
        body.prediction.probabilities.awayWin,
      100
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /api/predict rejects matches without confirmed teams", async () => {
  const server = createServer({
    kimiApiKey: "",
    matches: [
      {
        id: "unknown-teams",
        stage: "Final",
        kickoff: "2026-07-19T19:00:00Z",
        venue: "New York/New Jersey Stadium",
        homeTeamId: null,
        awayTeamId: null,
        homePlaceholder: "W101",
        awayPlaceholder: "W102"
      }
    ],
    teams: {}
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: "unknown-teams" })
    });

    assert.equal(response.status, 422);
    const body = await response.json();
    assert.match(body.error, /not confirmed/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /api/predict sends preset rules separately from user rules", async () => {
  const confirmedMatch = matches.find((match) => match.homeTeamId && match.awayTeamId);
  let requestPayload;
  const server = createServer({
    kimiApiKey: "test-key",
    presetRules: "项目预设：东道主揭幕战加成",
    fetchImpl: async (_url, options) => {
      requestPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  predictedScore: "1-0",
                  scoreOptions: [
                    { score: "1-0", probability: 38 },
                    { score: "1-1", probability: 24 },
                    { score: "2-0", probability: 18 }
                  ],
                  probabilities: { homeWin: 45, draw: 30, awayWin: 25 },
                  reasoning: ["Preset and user rules were considered."]
                })
              }
            }
          ]
        })
      };
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: confirmedMatch.id,
        rules: "用户倾向：比分保守"
      })
    });

    assert.equal(response.status, 200);
    const promptPayload = JSON.parse(requestPayload.messages[1].content);
    assert.equal(promptPayload.presetRules, "项目预设：东道主揭幕战加成");
    assert.equal(promptPayload.userRules, "用户倾向：比分保守");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET static JavaScript disables caching so updated data modules reload", async () => {
  const server = createServer({ kimiApiKey: "" });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/src/data.js`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
