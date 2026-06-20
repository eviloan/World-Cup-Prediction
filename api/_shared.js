import { readFile } from "node:fs/promises";

import { matches, teams } from "../src/data.js";
import { matchResultsById } from "../src/matchResultsData.js";
import { predictMatch } from "../src/prediction.js";

export function sendJson(response, payload, status = 200) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body);

  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 100_000) {
      throw new Error("Request body is too large.");
    }
  }

  return raw ? JSON.parse(raw) : {};
}

export function serializeMatchWithTeams(match, teamMap = teams) {
  const home = match.homeTeamId ? teamMap[match.homeTeamId] : null;
  const away = match.awayTeamId ? teamMap[match.awayTeamId] : null;

  return {
    ...match,
    result: matchResultsById[match.id] ?? null,
    homeTeam: home,
    awayTeam: away
  };
}

export async function handleWorldcup(request, response) {
  if (request.method !== "GET") {
    sendJson(response, { error: "Method not allowed." }, 405);
    return;
  }

  sendJson(response, {
    matches: matches.map((match) => serializeMatchWithTeams(match)),
    teams: Object.values(teams)
  });
}

export async function handlePredict(request, response) {
  if (request.method !== "POST") {
    sendJson(response, { error: "Method not allowed." }, 405);
    return;
  }

  const body = await readJsonBody(request);
  const match = matches.find((item) => item.id === body.matchId);

  if (!match) {
    sendJson(response, { error: "Unknown matchId." }, 404);
    return;
  }

  if (!match.homeTeamId || !match.awayTeamId) {
    sendJson(response, { error: "Match teams are not confirmed yet." }, 422);
    return;
  }

  const presetRules = await readPresetRules();
  const prediction = await predictMatch({
    match,
    teams,
    rules: String(body.rules ?? ""),
    presetRules,
    kimiApiKey: process.env.MIMO_API_KEY ?? process.env.KIMI_API_KEY ?? "",
    kimiBaseUrl:
      process.env.MIMO_BASE_URL ??
      process.env.KIMI_BASE_URL ??
      "https://api.xiaomimimo.com/v1/chat/completions",
    kimiModel: process.env.MIMO_MODEL ?? process.env.KIMI_MODEL ?? "mimo-v2.5-pro"
  });

  sendJson(response, { prediction });
}

async function readPresetRules() {
  try {
    return await readFile(new URL("../prediction-rules.md", import.meta.url), "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return "";
    throw error;
  }
}
