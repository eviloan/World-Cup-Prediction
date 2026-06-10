import assert from "node:assert/strict";
import test from "node:test";

import predictHandler from "../api/predict.js";
import worldcupHandler from "../api/worldcup.js";
import { matches } from "../src/data.js";

test("Vercel GET /api/worldcup returns matches and teams", async () => {
  const response = createMockResponse();

  await worldcupHandler({ method: "GET" }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.ok(response.body.matches.length > 0);
  assert.ok(response.body.teams.length > 0);
});

test("Vercel POST /api/predict returns local fallback without API key", async () => {
  const confirmedMatch = matches.find((match) => match.homeTeamId && match.awayTeamId);
  const response = createMockResponse();

  await predictHandler(
    {
      method: "POST",
      body: {
        matchId: confirmedMatch.id,
        rules: "用户倾向：小比分"
      }
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.match, undefined);
  assert.equal(response.body.prediction.source, "local-rules");
  assert.match(response.body.prediction.predictedScore, /^\d+-\d+$/);
  assert.equal(response.body.prediction.scoreOptions.length, 3);
});

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(value) {
      this.rawBody = value;
      this.body = JSON.parse(value);
    }
  };
}
