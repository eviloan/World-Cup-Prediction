import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKimiMessages,
  createLocalPrediction,
  predictMatch,
  normalizeProbabilities
} from "../src/prediction.js";

const match = {
  id: "m1",
  stage: "Group A",
  kickoff: "2026-06-11T20:00:00-07:00",
  venue: "Estadio Azteca",
  homeTeamId: "mex",
  awayTeamId: "can"
};

const teams = {
  mex: {
    id: "mex",
    name: "Mexico",
    fifaRank: 14,
    attack: 78,
    defense: 76,
    form: 74
  },
  can: {
    id: "can",
    name: "Canada",
    fifaRank: 31,
    attack: 74,
    defense: 71,
    form: 72
  }
};

test("normalizeProbabilities returns percentages that add to 100", () => {
  const result = normalizeProbabilities({ homeWin: 3, draw: 2, awayWin: 1 });

  assert.deepEqual(result, { homeWin: 50, draw: 33, awayWin: 17 });
});

test("createLocalPrediction returns score and probability guidance", () => {
  const result = createLocalPrediction(match, teams, "主队有主场优势");

  assert.equal(result.source, "local-rules");
  assert.match(result.predictedScore, /^\d+-\d+$/);
  assert.equal(result.scoreOptions.length, 3);
  assert.equal(result.scoreOptions[0].score, result.predictedScore);
  assert.equal(
    result.probabilities.homeWin + result.probabilities.draw + result.probabilities.awayWin,
    100
  );
  assert.ok(result.reasoning.some((line) => line.includes("Mexico")));
});

test("buildKimiMessages includes match context and user rules", () => {
  const baseline = createLocalPrediction(match, teams, "主队有主场优势");
  const messages = buildKimiMessages(match, teams, "优先考虑近期伤病", baseline);

  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
  assert.match(messages[1].content, /Mexico/);
  assert.match(messages[1].content, /Canada/);
  assert.match(messages[1].content, /优先考虑近期伤病/);
});

test("buildKimiMessages keeps preset rules separate from user rules", () => {
  const baseline = createLocalPrediction(match, teams, "用户偏向小比分", "项目预设：东道主加成");
  const messages = buildKimiMessages(match, teams, "用户偏向小比分", baseline, "项目预设：东道主加成");
  const payload = JSON.parse(messages[1].content);

  assert.equal(payload.presetRules, "项目预设：东道主加成");
  assert.equal(payload.userRules, "用户偏向小比分");
});

test("createLocalPrediction mentions preset rules and user rules separately", () => {
  const result = createLocalPrediction(match, teams, "用户偏向小比分", "项目预设：东道主加成");

  assert.ok(result.reasoning.some((line) => line.includes("Project preset rules")));
  assert.ok(result.reasoning.some((line) => line.includes("User rules")));
});

test("createLocalPrediction summarizes long rule documents for display", () => {
  const longPresetRules = `# World Cup Prediction Rules

## 执行原则

- 必须综合判断，不允许只依赖 FIFA 排名、球队名气或单一数据。
- 如果缺少可靠实时信息，不要编造伤病、内部矛盾或负面新闻。
- 预测结果必须包含合理比分、胜平负概率和简短原因。

## 权重参考

1. 基础实力：40%
   - FIFA ranking。
   - Transfermarkt 球队总身价与关键球员身价。`;

  const result = createLocalPrediction(match, teams, "用户输入了一条很长的临场倾向。".repeat(12), longPresetRules);

  assert.ok(result.reasoning.every((line) => line.length <= 180));
  assert.ok(result.reasoning.some((line) => line.includes("Project preset rules")));
  assert.ok(!result.reasoning.some((line) => line.includes("# World Cup Prediction Rules")));
  assert.ok(!result.reasoning.some((line) => line.includes("## 权重参考")));
});

test("predictMatch falls back to local prediction when Kimi is unavailable", async () => {
  const result = await predictMatch({
    match,
    teams,
    rules: "杯赛淘汰赛保守",
    kimiApiKey: "",
    fetchImpl: async () => {
      throw new Error("network should not be called");
    }
  });

  assert.equal(result.source, "local-rules");
  assert.equal(result.fallbackReason, "MIMO_API_KEY is not configured.");
});

test("predictMatch parses MiMo JSON predictions when available", async () => {
  const result = await predictMatch({
    match,
    teams,
    rules: "主队轮换",
    kimiApiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                  predictedScore: "2-1",
                  scoreOptions: [
                    { score: "2-1", probability: 42 },
                    { score: "1-1", probability: 28 },
                    { score: "1-0", probability: 18 }
                  ],
                  probabilities: { homeWin: 56, draw: 25, awayWin: 19 },
                  reasoning: ["MiMo says Mexico has the stronger attack."]
                })
            }
          }
        ]
      })
    })
  });

  assert.equal(result.source, "mimo");
  assert.equal(result.predictedScore, "2-1");
  assert.deepEqual(result.scoreOptions, [
    { score: "2-1", probability: 42 },
    { score: "1-1", probability: 28 },
    { score: "1-0", probability: 18 }
  ]);
  assert.deepEqual(result.probabilities, { homeWin: 56, draw: 25, awayWin: 19 });
});

test("buildKimiMessages sends compact match and team summaries", () => {
  const playerHeavyTeams = {
    mex: {
      ...teams.mex,
      players: [{ name: "Player A" }, { name: "Player B" }]
    },
    can: {
      ...teams.can,
      players: [{ name: "Player C" }]
    }
  };
  const baseline = createLocalPrediction(match, playerHeavyTeams);
  const messages = buildKimiMessages(match, playerHeavyTeams, "", baseline);
  const payload = JSON.parse(messages[1].content);

  assert.equal(payload.match.id, match.id);
  assert.equal(payload.teams.home.name, "Mexico");
  assert.equal(payload.teams.home.players, undefined);
  assert.equal(payload.teams.away.players, undefined);
});

test("predictMatch sanitizes multiline API keys before building headers", async () => {
  let authorizationHeader = "";
  const result = await predictMatch({
    match,
    teams,
    kimiApiKey: "  test-key\n test-key\n",
    fetchImpl: async (_url, options) => {
      authorizationHeader = options.headers.Authorization;
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  predictedScore: "1-1",
                  scoreOptions: [
                    { score: "1-1", probability: 36 },
                    { score: "2-1", probability: 24 },
                    { score: "1-0", probability: 18 }
                  ],
                  probabilities: { homeWin: 35, draw: 35, awayWin: 30 },
                  reasoning: ["Header was accepted."]
                })
              }
            }
          ]
        })
      };
    }
  });

  assert.equal(result.source, "mimo");
  assert.equal(authorizationHeader, "Bearer test-key");
});

test("predictMatch redacts API keys from fallback errors", async () => {
  const result = await predictMatch({
    match,
    teams,
    kimiApiKey: "sk-secret-value\nsk-secret-value",
    fetchImpl: async () => {
      throw new Error(
        'Headers.append: "Bearer sk-secret-value\nsk-secret-value" is an invalid header value.'
      );
    }
  });

  assert.equal(result.source, "local-rules");
  assert.doesNotMatch(result.fallbackReason, /sk-secret-value/);
  assert.match(result.fallbackReason, /invalid Authorization header value/);
});

test("predictMatch falls back when MiMo request exceeds timeout", async () => {
  const result = await predictMatch({
    match,
    teams,
    kimiApiKey: "test-key",
    kimiTimeoutMs: 5,
    fetchImpl: async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("aborted")));
      })
  });

  assert.equal(result.source, "local-rules");
  assert.match(result.fallbackReason, /timed out/);
});
