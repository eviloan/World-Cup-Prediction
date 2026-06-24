const EMPTY_STANDINGS = {
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

export function buildGroupStandings(teams) {
  const collator = new Intl.Collator("en");
  const groups = new Map();

  for (const team of teams) {
    const group = team.group || "Unassigned";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({
      ...team,
      standings: normalizeStandings(team.currentTournamentStats)
    });
  }

  return [...groups.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([group, groupTeams]) => ({
      group,
      teams: groupTeams.sort((a, b) => compareStandingTeams(a, b, collator))
    }));
}

function compareStandingTeams(a, b, collator) {
  return (
    b.standings.points - a.standings.points ||
    b.standings.goalDifference - a.standings.goalDifference ||
    b.standings.goalsFor - a.standings.goalsFor ||
    collator.compare(a.name, b.name)
  );
}

function normalizeStandings(stats) {
  return {
    ...EMPTY_STANDINGS,
    ...(stats ?? {}),
    form: [...(stats?.form ?? [])]
  };
}
