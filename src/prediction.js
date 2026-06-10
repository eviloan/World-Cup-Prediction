const SCORE_PATTERN = /^\d{1,2}-\d{1,2}$/;

export function normalizeProbabilities(input) {
  const values = {
    homeWin: Math.max(0, Number(input.homeWin) || 0),
    draw: Math.max(0, Number(input.draw) || 0),
    awayWin: Math.max(0, Number(input.awayWin) || 0)
  };
  const total = values.homeWin + values.draw + values.awayWin;

  if (total <= 0) {
    return { homeWin: 34, draw: 33, awayWin: 33 };
  }

  const homeWin = Math.round((values.homeWin / total) * 100);
  const draw = Math.round((values.draw / total) * 100);
  const awayWin = 100 - homeWin - draw;

  return { homeWin, draw, awayWin };
}

export function createLocalPrediction(match, teams, rules = "", presetRules = "") {
  const home = teams[match.homeTeamId];
  const away = teams[match.awayTeamId];

  if (!home || !away) {
    throw new Error("Match references an unknown team.");
  }

  const homeScore =
    home.attack * 0.36 +
    home.defense * 0.18 +
    home.form * 0.28 +
    rankScore(home.fifaRank) * 0.12 +
    4;
  const awayScore =
    away.attack * 0.36 +
    away.defense * 0.18 +
    away.form * 0.28 +
    rankScore(away.fifaRank) * 0.12;
  const delta = homeScore - awayScore;
  const drawBase = Math.max(18, 30 - Math.abs(delta) * 0.65);
  const probabilities = normalizeProbabilities({
    homeWin: 35 + delta * 1.8,
    draw: drawBase,
    awayWin: 35 - delta * 1.8
  });
  const [homeGoals, awayGoals] = estimateScore(delta, home.attack, away.attack);

  return {
    source: "local-rules",
    predictedScore: `${homeGoals}-${awayGoals}`,
    probabilities,
    reasoning: [
      `${home.name} attack/form baseline: ${home.attack}/${home.form}.`,
      `${away.name} attack/form baseline: ${away.attack}/${away.form}.`,
      presetRules.trim()
        ? `Project preset rules considered locally: ${summarizeRules(presetRules)}`
        : "No project preset rules were provided.",
      rules.trim()
        ? `User rules considered locally: ${summarizeRules(rules)}`
        : "No extra user rules were provided."
    ]
  };
}

export function buildPredictionMessages(match, teams, rules, baseline, presetRules = "") {
  const home = teams[match.homeTeamId];
  const away = teams[match.awayTeamId];

  return [
    {
      role: "system",
      content:
        "You are a football match prediction analyst. Return strict JSON only, with no markdown."
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task:
            "Predict this World Cup match. Output JSON with predictedScore, probabilities, and reasoning.",
          requiredShape: {
            predictedScore: "number-number, for example 2-1",
            probabilities: {
              homeWin: "integer percentage",
              draw: "integer percentage",
              awayWin: "integer percentage"
            },
            reasoning: ["short reason 1", "short reason 2"]
          },
          match,
          teams: { home, away },
          baseline,
          presetRules: presetRules || "No project preset rules.",
          userRules: rules || "No extra user rules."
        },
        null,
        2
      )
    }
  ];
}

export async function predictMatch({
  match,
  teams,
  rules = "",
  presetRules = "",
  kimiApiKey = "",
  kimiBaseUrl = "https://api.xiaomimimo.com/v1/chat/completions",
  kimiModel = "mimo-v2.5-pro",
  fetchImpl = globalThis.fetch
}) {
  const baseline = createLocalPrediction(match, teams, rules, presetRules);
  const apiKey = normalizeApiKey(kimiApiKey);

  if (!apiKey) {
    return {
      ...baseline,
      fallbackReason: "MIMO_API_KEY is not configured."
    };
  }

  if (!fetchImpl) {
    return {
      ...baseline,
      fallbackReason: "fetch is not available in this Node runtime."
    };
  }

  try {
    const response = await fetchImpl(kimiBaseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: kimiModel,
        temperature: 0.35,
        messages: buildPredictionMessages(match, teams, rules, baseline, presetRules)
      })
    });

    if (!response.ok) {
      throw new Error(`MiMo API returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseKimiPrediction(content);

    return {
      source: "mimo",
      predictedScore: parsed.predictedScore,
      probabilities: normalizeProbabilities(parsed.probabilities),
      reasoning: normalizeReasoning(parsed.reasoning)
    };
  } catch (error) {
    return {
      ...baseline,
      fallbackReason: fallbackReason(error)
    };
  }
}

export const buildKimiMessages = buildPredictionMessages;

function rankScore(rank) {
  return Math.max(40, 100 - Math.max(0, rank - 1) * 1.15);
}

function estimateScore(delta, homeAttack, awayAttack) {
  const baseHome = homeAttack >= 80 ? 2 : 1;
  const baseAway = awayAttack >= 80 ? 2 : 1;

  if (delta > 9) return [Math.min(4, baseHome + 1), Math.max(0, baseAway - 1)];
  if (delta > 3) return [baseHome + 1, baseAway];
  if (delta < -9) return [Math.max(0, baseHome - 1), Math.min(4, baseAway + 1)];
  if (delta < -3) return [baseHome, baseAway + 1];
  return [baseHome, baseAway];
}

function parseKimiPrediction(content) {
  if (!content || typeof content !== "string") {
    throw new Error("Kimi response did not include message content.");
  }

  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned);

  if (!SCORE_PATTERN.test(parsed.predictedScore)) {
    throw new Error("Kimi response did not include a valid predictedScore.");
  }

  return parsed;
}

function normalizeReasoning(reasoning) {
  if (!Array.isArray(reasoning)) {
    return ["Kimi returned a prediction without detailed reasoning."];
  }

  return reasoning.map((item) => String(item)).filter(Boolean).slice(0, 5);
}

function summarizeRules(value) {
  const meaningfulLines = String(value)
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#{1,6}\s*/, "")
        .replace(/^\s*[-*]\s*/, "")
        .replace(/^\s*\d+\.\s*/, "")
        .trim()
    )
    .filter(Boolean)
    .filter((line) => !line.includes("presetRules") && !line.includes("userRules"));

  const summary = meaningfulLines.slice(0, 2).join(" ");
  return truncate(summary || String(value).trim().replace(/\s+/g, " "), 126);
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function normalizeApiKey(value) {
  return String(value ?? "")
    .split(/\s+/)
    .find(Boolean) ?? "";
}

function fallbackReason(error) {
  if (!(error instanceof Error)) return "MiMo prediction failed.";

  const message = error.message;
  if (/headers?\.append|authorization|invalid header value/i.test(message)) {
    return "MiMo request failed: invalid Authorization header value.";
  }

  return redactSecrets(message);
}

function redactSecrets(value) {
  return String(value).replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***");
}
