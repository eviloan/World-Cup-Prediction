import { getMatchOdds } from "./odds.js";
import { teamHistoryByTeamId } from "./teamHistoryData.js";

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
  const marketOdds = summarizeMarketOdds(match);

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
  const scoreOptions = estimateScoreOptions(homeGoals, awayGoals, probabilities);

  return {
    source: "local-rules",
    predictedScore: `${homeGoals}-${awayGoals}`,
    scoreOptions,
    probabilities,
    reasoning: [
      `${home.name} attack/form baseline: ${home.attack}/${home.form}.`,
      `${away.name} attack/form baseline: ${away.attack}/${away.form}.`,
      presetRules.trim()
        ? `Project preset rules considered locally: ${summarizeRules(presetRules)}`
        : "No project preset rules were provided.",
      rules.trim()
        ? `User rules considered locally: ${summarizeRules(rules)}`
        : "No extra user rules were provided.",
      marketOdds.status === "available"
        ? `Market odds considered locally: ${marketOdds.selections.map((selection) => `${selection.label} ${selection.value}`).join(", ")}.`
        : "Market odds were not available for this match."
    ]
  };
}

export function buildPredictionMessages(match, teams, rules, baseline, presetRules = "", teamHistory = teamHistoryByTeamId) {
  const home = teams[match.homeTeamId];
  const away = teams[match.awayTeamId];
  const matchSummary = summarizeMatch(match);
  const teamSummaries = {
    home: summarizeTeam(home),
    away: summarizeTeam(away)
  };
  const history = summarizeHistory(match, teamHistory);
  const marketOdds = summarizeMarketOdds(match);

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
            "Predict this World Cup match. Output strict JSON only. Keep the response compact.",
          instructions: [
            "Reasoning must explicitly cover recent form for both teams, using the provided form rating and any recent-performance rules in presetRules/userRules.",
            "Reasoning must explicitly cover head-to-head or historical record. If reliable head-to-head data is not present in the provided context, say the available context is limited instead of inventing results.",
            "Use market odds as one reference condition. Do not blindly copy the odds; explain any major difference between your prediction and the market odds.",
            "At least one reasoning item must mention 历史战绩, and at least one reasoning item must mention 最近表现."
          ],
          requiredShape: {
            predictedScore: "number-number, for example 2-1",
            scoreOptions: [
              { score: "number-number", probability: "integer likelihood for this exact score" },
              { score: "number-number", probability: "integer likelihood for this exact score" },
              { score: "number-number", probability: "integer likelihood for this exact score" }
            ],
            probabilities: {
              homeWin: "integer percentage",
              draw: "integer percentage",
              awayWin: "integer percentage"
            },
            reasoning: [
              "最近表现: compare both teams' recent form / form rating in one short sentence",
              "历史战绩: compare head-to-head or World Cup historical context; state limited context if no reliable data is provided",
              "赔率参考: summarize how market odds influenced the result, or say odds are unavailable",
              "one short tactical or squad-value reason"
            ]
          },
          match: matchSummary,
          teams: teamSummaries,
          history,
          marketOdds,
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
  kimiModel = "mimo-v2-flash",
  kimiTimeoutMs = 60_000,
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

  let timeout;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), kimiTimeoutMs);
    const response = await fetchImpl(kimiBaseUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: kimiModel,
        temperature: 0.35,
        max_completion_tokens: 512,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        messages: buildPredictionMessages(match, teams, rules, baseline, presetRules)
      })
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`MiMo API returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseKimiPrediction(content);

    return {
      source: "mimo",
      predictedScore: parsed.predictedScore,
      scoreOptions: normalizeScoreOptions(parsed.scoreOptions, parsed.predictedScore),
      probabilities: normalizeProbabilities(parsed.probabilities),
      reasoning: normalizeReasoning(parsed.reasoning)
    };
  } catch (error) {
    if (timeout) clearTimeout(timeout);
    return {
      ...baseline,
      fallbackReason: fallbackReason(error, kimiTimeoutMs)
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

function estimateScoreOptions(homeGoals, awayGoals, probabilities) {
  const options = [
    { score: `${homeGoals}-${awayGoals}`, probability: 38 }
  ];

  if (probabilities.draw >= probabilities.homeWin && probabilities.draw >= probabilities.awayWin) {
    options.push({ score: `${Math.max(0, homeGoals - 1)}-${Math.max(0, homeGoals - 1)}`, probability: 28 });
    options.push({ score: `${homeGoals + 1}-${awayGoals + 1}`, probability: 18 });
  } else if (probabilities.homeWin >= probabilities.awayWin) {
    options.push({ score: `${Math.max(1, homeGoals - 1)}-${awayGoals}`, probability: 24 });
    options.push({ score: `${homeGoals}-${Math.max(0, awayGoals - 1)}`, probability: 18 });
  } else {
    options.push({ score: `${homeGoals}-${Math.max(1, awayGoals - 1)}`, probability: 24 });
    options.push({ score: `${Math.max(0, homeGoals - 1)}-${awayGoals}`, probability: 18 });
  }

  return normalizeScoreOptions(options, `${homeGoals}-${awayGoals}`);
}

function normalizeScoreOptions(options, predictedScore) {
  const normalized = Array.isArray(options)
    ? options
        .map((option) => ({
          score: String(option?.score ?? ""),
          probability: Math.max(0, Math.round(Number(option?.probability) || 0))
        }))
        .filter((option) => SCORE_PATTERN.test(option.score))
    : [];

  return dedupeScoreOptions([
    ...normalized,
    { score: predictedScore, probability: normalized[0]?.probability || 38 },
    ...fallbackScoreOptions(predictedScore)
  ]).slice(0, 3);
}

function fallbackScoreOptions(predictedScore) {
  const [homeGoals, awayGoals] = predictedScore.split("-").map((value) => Number(value));
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return [];

  return [
    { score: `${Math.max(0, homeGoals - 1)}-${awayGoals}`, probability: 22 },
    { score: `${homeGoals}-${Math.max(0, awayGoals - 1)}`, probability: 18 },
    { score: `${homeGoals + 1}-${awayGoals}`, probability: 14 }
  ];
}

function dedupeScoreOptions(options) {
  const seen = new Set();
  return options.filter((option) => {
    if (!SCORE_PATTERN.test(option.score) || seen.has(option.score)) return false;
    seen.add(option.score);
    return true;
  });
}

function summarizeMatch(match) {
  return {
    id: match.id,
    stage: match.stage,
    kickoff: match.kickoff,
    venue: match.venue,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId
  };
}

function summarizeTeam(team) {
  return {
    id: team.id,
    name: team.name,
    group: team.group,
    confederation: team.confederation,
    fifaRank: team.fifaRank,
    attack: team.attack,
    defense: team.defense,
    form: team.form,
    coach: team.coach,
    marketValue: team.marketValue,
    keyPlayers: summarizeKeyPlayers(team.players)
  };
}

function summarizeHistory(match, teamHistory) {
  const homeHistory = teamHistory?.[match.homeTeamId] ?? {};
  const awayHistory = teamHistory?.[match.awayTeamId] ?? {};

  return {
    home: {
      worldCupRecord: homeHistory.worldCupRecord ?? null,
      recentForm: homeHistory.recentForm ?? null
    },
    away: {
      worldCupRecord: awayHistory.worldCupRecord ?? null,
      recentForm: awayHistory.recentForm ?? null
    },
    headToHead: homeHistory.headToHead?.[match.awayTeamId] ?? null
  };
}

function summarizeMarketOdds(match) {
  const odds = getMatchOdds(match);

  return {
    source: odds.source,
    sourceUrl: odds.sourceUrl,
    status: odds.status,
    updatedText: odds.updatedText || odds.updatedAt || "",
    selections: odds.selections.map((selection) => ({
      key: selection.key,
      label: selection.label,
      team: selection.team,
      value: selection.value
    }))
  };
}

function summarizeKeyPlayers(players = []) {
  return [...players]
    .sort((a, b) => marketAmount(b.marketValue) - marketAmount(a.marketValue))
    .slice(0, 6)
    .map((player) => ({
      name: player.name,
      position: player.position,
      club: player.club,
      marketValue: player.marketValue,
      stats: player.stats
    }));
}

function marketAmount(value) {
  return value && typeof value === "object" ? Number(value.amount) || 0 : 0;
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

function fallbackReason(error, timeoutMs) {
  if (!(error instanceof Error)) return "MiMo prediction failed.";

  const message = error.message;
  if (error.name === "AbortError" || /aborted/i.test(message)) {
    return `MiMo request timed out after ${Math.round(timeoutMs / 1000)}s.`;
  }
  if (/headers?\.append|authorization|invalid header value/i.test(message)) {
    return "MiMo request failed: invalid Authorization header value.";
  }

  return redactSecrets(message);
}

function redactSecrets(value) {
  return String(value).replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***");
}
