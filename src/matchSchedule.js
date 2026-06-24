export function groupMatchesByDate(matches) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Shanghai"
  });
  const groups = new Map();

  for (const match of matches.slice().sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))) {
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai"
  }).formatToParts(new Date(match.kickoff));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
