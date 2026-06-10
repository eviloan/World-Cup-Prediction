const POSITION_ORDER = new Map([
  ["GK", 0],
  ["DF", 1],
  ["MF", 2],
  ["FW", 3]
]);

const POSITION_GROUPS = [
  { key: "GK", label: "守门员" },
  { key: "DF", label: "后卫" },
  { key: "MF", label: "中场" },
  { key: "FW", label: "前锋" },
  { key: "OTHER", label: "其他" }
];

export function sortPlayersByPosition(players) {
  return [...players].sort((a, b) => {
    const positionDelta = positionRank(a.position) - positionRank(b.position);
    if (positionDelta !== 0) return positionDelta;

    const numberDelta = jerseyRank(a.jerseyNumber) - jerseyRank(b.jerseyNumber);
    if (numberDelta !== 0) return numberDelta;

    return String(a.name ?? "").localeCompare(String(b.name ?? ""), "en");
  });
}

export function groupPlayersByPosition(players) {
  const groups = new Map(POSITION_GROUPS.map((group) => [group.key, { ...group, players: [] }]));

  for (const player of sortPlayersByPosition(players)) {
    const key = POSITION_ORDER.has(String(player.position ?? "").toUpperCase())
      ? String(player.position ?? "").toUpperCase()
      : "OTHER";
    groups.get(key).players.push(player);
  }

  return [...groups.values()].filter((group) => group.players.length > 0);
}

function positionRank(position) {
  return POSITION_ORDER.get(String(position ?? "").toUpperCase()) ?? 99;
}

function jerseyRank(number) {
  const parsed = Number(number);
  return Number.isFinite(parsed) ? parsed : 999;
}
