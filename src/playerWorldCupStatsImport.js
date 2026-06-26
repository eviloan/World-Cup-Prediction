const STAT_KEYS = ["appearances", "goals", "assists", "minutesPlayed"];

export function buildPlayerWorldCupStatsData({ teams, liveMatches }) {
  const rosterByFifaId = buildRosterIndex(teams);
  const playerWorldCupStatsByFifaId = Object.fromEntries(
    [...rosterByFifaId.values()].map((player) => [
      player.fifaId,
      {
        fifaId: player.fifaId,
        name: player.name,
        teamId: player.teamId,
        teamName: player.teamName,
        stats: emptyStats()
      }
    ])
  );

  for (const match of liveMatches) {
    applyTeamMatch(playerWorldCupStatsByFifaId, match.HomeTeam, match);
    applyTeamMatch(playerWorldCupStatsByFifaId, match.AwayTeam, match);
  }

  const rankedPlayers = Object.values(playerWorldCupStatsByFifaId);
  const assistLeaderboard = buildLeaderboard(rankedPlayers, "assists");

  return {
    playerWorldCupStatsByFifaId,
    goalLeaderboard: buildLeaderboard(rankedPlayers, "goals"),
    assistLeaderboard,
    assistsAvailable: assistLeaderboard.length > 0
  };
}

function buildRosterIndex(teams) {
  const index = new Map();
  for (const team of Object.values(teams)) {
    for (const player of team.players ?? []) {
      const fifaId = String(player.fifaId ?? "");
      if (!fifaId) continue;
      index.set(fifaId, {
        fifaId,
        name: player.name,
        teamId: team.id,
        teamName: team.name
      });
    }
  }
  return index;
}

function applyTeamMatch(statsByFifaId, team, match) {
  if (!team) return;

  const duration = parseMinute(match.MatchTime) || 90;
  const substitutions = team.Substitutions ?? [];
  const players = team.Players ?? [];
  const minutesByPlayerId = new Map();

  for (const player of players) {
    const playerId = String(player.IdPlayer ?? "");
    if (!statsByFifaId[playerId]) continue;

    const status = Number(player.Status);
    const subOn = substitutions.find((item) => String(item.IdPlayerOn) === playerId);
    const subOff = substitutions.find((item) => String(item.IdPlayerOff) === playerId);
    let minutes = 0;

    if (status === 1) {
      minutes = subOff ? parseMinute(subOff.Minute) : duration;
    } else if (subOn) {
      minutes = Math.max(0, duration - parseMinute(subOn.Minute));
    }

    minutesByPlayerId.set(playerId, minutes);
    if (minutes > 0) {
      statsByFifaId[playerId].stats.appearances += 1;
      statsByFifaId[playerId].stats.minutesPlayed += minutes;
    }
  }

  for (const goal of team.Goals ?? []) {
    const scorerId = String(goal.IdPlayer ?? "");
    if (statsByFifaId[scorerId] && Number(goal.Type) !== 1) {
      statsByFifaId[scorerId].stats.goals += 1;
    }

    const assistId = String(goal.IdAssistPlayer ?? "");
    if (statsByFifaId[assistId]) {
      statsByFifaId[assistId].stats.assists += 1;
      if (!minutesByPlayerId.has(assistId)) {
        statsByFifaId[assistId].stats.appearances += 1;
      }
    }
  }
}

function buildLeaderboard(players, statKey) {
  return players
    .filter((player) => Number(player.stats[statKey]) > 0)
    .slice()
    .sort(
      (a, b) =>
        Number(b.stats[statKey]) - Number(a.stats[statKey]) ||
        Number(b.stats.goals) - Number(a.stats.goals) ||
        Number(b.stats.assists) - Number(a.stats.assists) ||
        Number(b.stats.minutesPlayed) - Number(a.stats.minutesPlayed) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 20)
    .map((player, index) => ({
      rank: index + 1,
      fifaId: player.fifaId,
      name: player.name,
      teamId: player.teamId,
      teamName: player.teamName,
      value: player.stats[statKey],
      stats: pickStats(player.stats)
    }));
}

function pickStats(stats) {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, Number(stats[key]) || 0]));
}

function emptyStats() {
  return {
    appearances: 0,
    goals: 0,
    assists: 0,
    minutesPlayed: 0
  };
}

function parseMinute(value) {
  const minute = Number(String(value ?? "").match(/\d+/)?.[0] ?? 0);
  return Number.isFinite(minute) ? minute : 0;
}
