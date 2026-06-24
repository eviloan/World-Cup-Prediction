export function nextUpcomingMatchId(matches, now = new Date()) {
  const nowTime = now.getTime();
  const nextMatch = matches
    .filter((match) => !match.result)
    .filter((match) => Number.isFinite(Date.parse(match.kickoff)))
    .filter((match) => Date.parse(match.kickoff) > nowTime)
    .slice()
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))[0];

  return nextMatch?.id ?? null;
}
