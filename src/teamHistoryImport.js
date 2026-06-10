import { normalizeCountryName } from "./transfermarktImport.js";

const WORLD_CUP_COMPETITION_ID = "FIWC";
const RECENT_FORM_MATCH_LIMIT = 10;
const WORLD_CUP_SEASON_LIMIT = 3;

const ROUND_ORDER = new Map([
  ["group stage", 1],
  ["group", 1],
  ["first round", 1],
  ["second round", 2],
  ["round of 16", 3],
  ["last 16", 3],
  ["quarter-finals", 4],
  ["quarter finals", 4],
  ["quarter-final", 4],
  ["semi-finals", 5],
  ["semi finals", 5],
  ["semi-final", 5],
  ["third place", 6],
  ["third-place match", 6],
  ["final", 7]
]);

export function buildTeamHistoryData({ teams, currentMatches = [], gameRows = [] }) {
  const teamIndex = buildTeamIndex(teams);
  const histories = Object.fromEntries(
    Object.values(teams).map((team) => [
      team.id,
      {
        worldCupRecord: emptyRecordWithStage(),
        recentForm: emptyRecentForm(),
        headToHead: {}
      }
    ])
  );

  const normalizedGames = gameRows
    .map((row) => normalizeGame(row, teamIndex))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  applyWorldCupRecords(histories, normalizedGames);
  applyRecentForms(histories, normalizedGames);
  applyHeadToHead(histories, normalizedGames, currentMatches);

  return {
    teamHistoryByTeamId: histories,
    summary: {
      teams: Object.keys(histories).length,
      games: normalizedGames.length
    }
  };
}

function buildTeamIndex(teams) {
  const index = new Map();

  for (const team of Object.values(teams)) {
    index.set(normalizeCountryName(team.name), team.id);
    if (team.id === "usa") index.set("united states", team.id);
    if (team.name === "Korea Republic") index.set("south korea", team.id);
    if (team.name === "Türkiye") index.set("turkey", team.id);
  }

  return index;
}

function normalizeGame(row, teamIndex) {
  const homeTeamId = teamIndex.get(normalizeCountryName(row.home_club_name));
  const awayTeamId = teamIndex.get(normalizeCountryName(row.away_club_name));
  if (!homeTeamId || !awayTeamId) return null;

  const homeGoals = Number(row.home_club_goals);
  const awayGoals = Number(row.away_club_goals);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return null;

  return {
    date: String(row.date ?? ""),
    competitionId: String(row.competition_id ?? ""),
    competitionType: String(row.competition_type ?? ""),
    season: String(row.season ?? ""),
    round: String(row.round ?? ""),
    homeTeamId,
    awayTeamId,
    homeGoals,
    awayGoals
  };
}

function applyWorldCupRecords(histories, games) {
  const worldCupGames = games.filter((game) => game.competitionId === WORLD_CUP_COMPETITION_ID);
  const recentSeasons = [...new Set(worldCupGames.map((game) => game.season))]
    .sort()
    .slice(-WORLD_CUP_SEASON_LIMIT);
  const seasonSet = new Set(recentSeasons);

  for (const game of worldCupGames) {
    if (!seasonSet.has(game.season)) continue;
    addPerspective(histories[game.homeTeamId].worldCupRecord, game.homeGoals, game.awayGoals);
    addPerspective(histories[game.awayTeamId].worldCupRecord, game.awayGoals, game.homeGoals);
    updateBestStage(histories[game.homeTeamId].worldCupRecord, game.round);
    updateBestStage(histories[game.awayTeamId].worldCupRecord, game.round);
  }
}

function applyRecentForms(histories, games) {
  const byTeam = new Map();

  for (const game of games) {
    if (game.competitionType !== "national_team_competition") continue;
    appendMapValue(byTeam, game.homeTeamId, { ...game, ownGoals: game.homeGoals, opponentGoals: game.awayGoals });
    appendMapValue(byTeam, game.awayTeamId, { ...game, ownGoals: game.awayGoals, opponentGoals: game.homeGoals });
  }

  for (const [teamId, teamGames] of byTeam) {
    const recentGames = teamGames
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, RECENT_FORM_MATCH_LIMIT);
    const recentForm = histories[teamId].recentForm;

    for (const game of recentGames) {
      addPerspective(recentForm.record, game.ownGoals, game.opponentGoals);
      recentForm.goalsFor += game.ownGoals;
      recentForm.goalsAgainst += game.opponentGoals;
    }

    recentForm.avgGoalsFor = average(recentForm.goalsFor, recentForm.record.matches);
    recentForm.avgGoalsAgainst = average(recentForm.goalsAgainst, recentForm.record.matches);
  }
}

function applyHeadToHead(histories, games, currentMatches) {
  for (const match of currentMatches) {
    if (!match.homeTeamId || !match.awayTeamId) continue;
    const homeRecord = emptyRecord();
    const awayRecord = emptyRecord();

    for (const game of games) {
      const sameOrder = game.homeTeamId === match.homeTeamId && game.awayTeamId === match.awayTeamId;
      const reverseOrder = game.homeTeamId === match.awayTeamId && game.awayTeamId === match.homeTeamId;
      if (!sameOrder && !reverseOrder) continue;

      const homeGoals = sameOrder ? game.homeGoals : game.awayGoals;
      const awayGoals = sameOrder ? game.awayGoals : game.homeGoals;
      addPerspective(homeRecord, homeGoals, awayGoals);
      addPerspective(awayRecord, awayGoals, homeGoals);
    }

    if (homeRecord.matches > 0) {
      histories[match.homeTeamId].headToHead[match.awayTeamId] = homeRecord;
      histories[match.awayTeamId].headToHead[match.homeTeamId] = awayRecord;
    }
  }
}

function addPerspective(record, ownGoals, opponentGoals) {
  record.matches += 1;
  record.goalsFor += ownGoals;
  record.goalsAgainst += opponentGoals;

  if (ownGoals > opponentGoals) record.wins += 1;
  else if (ownGoals < opponentGoals) record.losses += 1;
  else record.draws += 1;
}

function updateBestStage(record, round) {
  const normalized = normalizeRound(round);
  const currentScore = ROUND_ORDER.get(normalizeRound(record.bestStage)) ?? 0;
  const nextScore = ROUND_ORDER.get(normalized) ?? 0;
  if (nextScore > currentScore) record.bestStage = round || record.bestStage;
}

function emptyRecordWithStage() {
  return {
    ...emptyRecord(),
    bestStage: ""
  };
}

function emptyRecentForm() {
  return {
    record: emptyRecord(),
    goalsFor: 0,
    goalsAgainst: 0,
    avgGoalsFor: 0,
    avgGoalsAgainst: 0
  };
}

function emptyRecord() {
  return {
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0
  };
}

function appendMapValue(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function average(total, count) {
  return count ? Math.round((total / count) * 100) / 100 : 0;
}

function normalizeRound(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();
}
