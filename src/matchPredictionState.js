export function canPredictMatch(match) {
  return Boolean(match?.homeTeam && match?.awayTeam && !match?.result);
}
