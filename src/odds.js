import { worldCupChampionOdds, worldCupOddsByMatchId, worldCupOddsSource } from "./oddsData.js";

export const WORLD_CUP_ODDS_URL = worldCupOddsSource.sourceUrl;

export function getMatchOdds(match) {
  const odds = worldCupOddsByMatchId[match?.id] ?? null;

  return {
    source: odds?.source ?? worldCupOddsSource.name,
    sourceUrl: odds?.sourceUrl ?? WORLD_CUP_ODDS_URL,
    updatedAt: odds?.updatedAt ?? "",
    updatedText: odds?.updatedText ?? "",
    status: odds ? "available" : "pending",
    selections: [
      {
        key: "homeWin",
        label: "主胜",
        team: match?.homeTeam?.name ?? match?.homePlaceholder ?? "主队",
        value: odds?.homeWin ?? null
      },
      {
        key: "draw",
        label: "平局",
        team: "Draw",
        value: odds?.draw ?? null
      },
      {
        key: "awayWin",
        label: "客胜",
        team: match?.awayTeam?.name ?? match?.awayPlaceholder ?? "客队",
        value: odds?.awayWin ?? null
      }
    ]
  };
}

export function getChampionOdds(limit = worldCupChampionOdds.length) {
  return {
    source: worldCupOddsSource.name,
    sourceUrl: WORLD_CUP_ODDS_URL,
    items: worldCupChampionOdds.slice(0, limit)
  };
}

export function formatOddsValue(value) {
  if (value === null || value === undefined || value === "") return "待同步";

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  return numeric.toFixed(2);
}
