export function buildMatchResultsData({ teams, matchesPayload, asOfDate = new Date() }) {
  const teamIdByFifaId = buildTeamIdByFifaId(teams);
  const finishedMatches = (matchesPayload.Results ?? [])
    .filter((match) => hasFinishedScore(match, asOfDate))
    .slice()
    .sort((a, b) => Number(a.MatchNumber ?? 0) - Number(b.MatchNumber ?? 0));
  const matchResultsById = {};
  const teamTournamentStatsById = Object.fromEntries(
    Object.keys(teams).map((teamId) => [teamId, emptyStats()])
  );

  for (const match of finishedMatches) {
    const homeTeamId = teamIdFor(match.Home, teamIdByFifaId);
    const awayTeamId = teamIdFor(match.Away, teamIdByFifaId);
    if (!homeTeamId || !awayTeamId) continue;

    const homeScore = Number(match.HomeTeamScore);
    const awayScore = Number(match.AwayTeamScore);
    const winnerTeamId = winnerIdFor(match.Winner, teamIdByFifaId);

    matchResultsById[match.IdMatch] = {
      matchId: match.IdMatch,
      matchNumber: match.MatchNumber,
      kickoff: match.Date,
      status: "finished",
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      winnerTeamId,
      matchTime: match.MatchTime ?? "",
      attendance: parseAttendance(match.Attendance)
    };

    applyTeamResult(teamTournamentStatsById[homeTeamId], homeScore, awayScore);
    applyTeamResult(teamTournamentStatsById[awayTeamId], awayScore, homeScore);
  }

  return {
    matchResultsById,
    teamTournamentStatsById: pruneEmptyStats(teamTournamentStatsById)
  };
}

function buildTeamIdByFifaId(teams) {
  const entries = [];
  for (const team of Object.values(teams)) {
    entries.push([String(team.fifaId), team.id]);
    entries.push([String(team.id).toUpperCase(), team.id]);
  }
  return new Map(entries.filter(([key]) => key && key !== "undefined"));
}

function hasFinishedScore(match, asOfDate) {
  const hasScore =
    Number.isFinite(Number(match.HomeTeamScore)) && Number.isFinite(Number(match.AwayTeamScore));
  if (!hasScore) return false;
  if (!match.Date) return true;
  return Date.parse(match.Date) <= asOfDate.getTime();
}

function teamIdFor(team, teamIdByFifaId) {
  if (!team) return "";
  return (
    teamIdByFifaId.get(String(team.IdTeam)) ??
    teamIdByFifaId.get(String(team.Abbreviation ?? "").toUpperCase()) ??
    ""
  );
}

function winnerIdFor(winner, teamIdByFifaId) {
  if (!winner) return "";
  return teamIdByFifaId.get(String(winner)) ?? teamIdByFifaId.get(String(winner).toUpperCase()) ?? "";
}

function emptyStats() {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  };
}

function applyTeamResult(stats, goalsFor, goalsAgainst) {
  stats.played += 1;
  stats.goalsFor += goalsFor;
  stats.goalsAgainst += goalsAgainst;
  stats.goalDifference = stats.goalsFor - stats.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    stats.wins += 1;
    stats.points += 3;
    stats.form.push("W");
  } else if (goalsFor < goalsAgainst) {
    stats.losses += 1;
    stats.form.push("L");
  } else {
    stats.draws += 1;
    stats.points += 1;
    stats.form.push("D");
  }
}

function pruneEmptyStats(statsByTeamId) {
  return Object.fromEntries(
    Object.entries(statsByTeamId).filter(([, stats]) => stats.played > 0)
  );
}

function parseAttendance(value) {
  const attendance = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(attendance) && attendance > 0 ? attendance : null;
}
