import { buildGroupStandings } from "./standings.js";

export const KNOCKOUT_ROUNDS = [
  { key: "round-of-32", label: "32强", stageNames: ["Round of 32"] },
  { key: "round-of-16", label: "16强", stageNames: ["Round of 16"] },
  { key: "quarter-final", label: "8强", stageNames: ["Quarter-final"] },
  { key: "semi-final", label: "半决赛", stageNames: ["Semi-final"] },
  { key: "third-place", label: "季军赛", stageNames: ["Play-off for third place"] },
  { key: "final", label: "决赛", stageNames: ["Final"] }
];

export function buildKnockoutBracket(matches, teams = []) {
  const projection = buildGroupProjection(teams);
  const roundsByStageName = new Map();
  for (const round of KNOCKOUT_ROUNDS) {
    for (const stageName of round.stageNames) {
      roundsByStageName.set(stageName, round);
    }
  }

  const matchesByRoundKey = new Map(KNOCKOUT_ROUNDS.map((round) => [round.key, []]));

  for (const match of matches) {
    const round = roundsByStageName.get(match.stageName);
    if (!round) continue;
    matchesByRoundKey.get(round.key).push(toBracketMatch(match, projection));
  }

  return KNOCKOUT_ROUNDS
    .map((round) => ({
      ...round,
      matches: matchesByRoundKey
        .get(round.key)
        .slice()
        .sort((a, b) => Number(a.matchNumber ?? 0) - Number(b.matchNumber ?? 0))
    }))
    .filter((round) => round.matches.length > 0);
}

function toBracketMatch(match, projection) {
  const winnerTeamId = match.result?.winnerTeamId ?? "";
  return {
    id: match.id,
    matchNumber: match.matchNumber,
    stage: match.stage,
    stageName: match.stageName,
    kickoff: match.kickoff,
    venue: match.venue ?? "",
    status: match.result ? "finished" : "scheduled",
    score: match.result ? `${match.result.homeScore}-${match.result.awayScore}` : "",
    home: toBracketSide(match.homeTeam, match.homePlaceholder, match.result?.homeScore, winnerTeamId, projection),
    away: toBracketSide(match.awayTeam, match.awayPlaceholder, match.result?.awayScore, winnerTeamId, projection)
  };
}

function toBracketSide(team, placeholder, score, winnerTeamId, projection) {
  const projectedTeam = team ? null : projection.teamFor(placeholder);
  const resolvedTeam = team ?? projectedTeam;

  return {
    team: resolvedTeam,
    label: resolvedTeam?.name ?? placeholder ?? "待定",
    sourceLabel: placeholder ?? "",
    placeholder: !resolvedTeam,
    projected: Boolean(projectedTeam),
    score: Number.isFinite(Number(score)) ? Number(score) : null,
    isWinner: Boolean(resolvedTeam?.id && winnerTeamId && resolvedTeam.id === winnerTeamId)
  };
}

function buildGroupProjection(teams) {
  const groups = buildGroupStandings(teams);
  const groupByLetter = new Map();
  const usedThirdTeamIds = new Set();

  for (const group of groups) {
    const letter = groupLetter(group.group);
    if (!letter) continue;
    groupByLetter.set(letter, group.teams);
  }

  const thirdPlaceTeams = [...groupByLetter.entries()]
    .map(([letter, groupTeams]) => ({ letter, team: groupTeams[2] }))
    .filter((item) => item.team)
    .sort((a, b) => compareProjectedTeams(a.team, b.team));

  return {
    teamFor(placeholder) {
      const value = String(placeholder ?? "").trim().toUpperCase();
      const direct = value.match(/^([12])([A-L])$/);
      if (direct) {
        const [, position, letter] = direct;
        return groupByLetter.get(letter)?.[Number(position) - 1] ?? null;
      }

      const third = value.match(/^3([A-L]+)$/);
      if (third) {
        const eligibleLetters = new Set(third[1].split(""));
        const candidate = thirdPlaceTeams.find(
          (item) => eligibleLetters.has(item.letter) && !usedThirdTeamIds.has(item.team.id)
        );
        if (!candidate) return null;
        usedThirdTeamIds.add(candidate.team.id);
        return candidate.team;
      }

      return null;
    }
  };
}

function compareProjectedTeams(a, b) {
  const collator = new Intl.Collator("en");
  return (
    b.standings.points - a.standings.points ||
    b.standings.goalDifference - a.standings.goalDifference ||
    b.standings.goalsFor - a.standings.goalsFor ||
    collator.compare(a.name, b.name)
  );
}

function groupLetter(groupName) {
  return String(groupName ?? "").match(/Group\s+([A-L])/i)?.[1]?.toUpperCase() ?? "";
}
