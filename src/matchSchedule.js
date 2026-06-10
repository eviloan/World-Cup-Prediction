export function groupMatchesByDate(matches) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const groups = new Map();

  for (const match of matches) {
    const dateKey = dateKeyForMatch(match);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        key: dateKey,
        label: formatter.format(new Date(match.kickoff)),
        matches: []
      });
    }
    groups.get(dateKey).matches.push(match);
  }

  return [...groups.values()];
}

export function toggleFavoriteMatch(favorites, matchId) {
  const next = new Set(favorites);
  if (next.has(matchId)) {
    next.delete(matchId);
  } else {
    next.add(matchId);
  }
  return next;
}

function dateKeyForMatch(match) {
  return String(match.kickoff ?? "").slice(0, 10);
}
