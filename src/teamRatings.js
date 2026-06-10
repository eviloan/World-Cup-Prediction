const DEFAULT_RANK = 100;
const DEFAULT_RATING = 72;
const SCORE_MIN = 55;
const SCORE_MAX = 92;

export function applyTeamRatings(teams, rankingRows = [], transfermarktPlayersByFifaId = {}) {
  const rankingByCode = buildRankingIndex(rankingRows);
  const entries = Object.entries(teams).map(([id, team]) => ({
    id,
    team,
    ranking: findRanking(team, rankingByCode),
    inputs: estimateTeamRatingInputs(team, transfermarktPlayersByFifaId)
  }));

  const maxRank = Math.max(
    ...entries.map(({ ranking }) => numberOrDefault(ranking?.Rank, DEFAULT_RANK)),
    DEFAULT_RANK
  );
  const attackScaler = createLogScaler(entries.map(({ inputs }) => inputs.attackValue));
  const defenseScaler = createLogScaler(entries.map(({ inputs }) => inputs.defenseValue));
  const squadScaler = createLogScaler(entries.map(({ inputs }) => inputs.squadValue));

  return Object.fromEntries(
    entries.map(({ id, team, ranking, inputs }) => {
      const fifaRank = numberOrDefault(ranking?.Rank, team.fifaRank ?? DEFAULT_RANK);
      const rankScore = scoreFromRank(fifaRank, maxRank);
      const attackScore = attackScaler(inputs.attackValue);
      const defenseScore = defenseScaler(inputs.defenseValue);
      const squadScore = squadScaler(inputs.squadValue);
      const movementScore = scoreFromMovement(ranking?.RankingMovement);

      return [
        id,
        {
          ...team,
          fifaRank,
          attack: clampRating(attackScore * 0.78 + rankScore * 0.22),
          defense: clampRating(defenseScore * 0.78 + rankScore * 0.22),
          form: clampRating(rankScore * 0.5 + squadScore * 0.3 + movementScore * 0.2)
        }
      ];
    })
  );
}

export function estimateTeamRatingInputs(team, transfermarktPlayersByFifaId = {}) {
  return (team.players ?? []).reduce(
    (totals, player) => {
      const value = marketValueAmount(transfermarktPlayersByFifaId[String(player.fifaId)]?.marketValue);
      const position = String(player.position ?? "").toUpperCase();

      totals.squadValue += value;
      if (position === "FW") totals.attackValue += value;
      if (position === "MF") {
        totals.attackValue += value * 0.45;
        totals.defenseValue += value * 0.25;
      }
      if (position === "DF" || position === "GK") totals.defenseValue += value;

      return totals;
    },
    { attackValue: 0, defenseValue: 0, squadValue: 0 }
  );
}

export function extractRankingPubDate(rankingRows = []) {
  return rankingRows.find((row) => row?.PubDate)?.PubDate ?? "";
}

function buildRankingIndex(rankingRows) {
  const byCode = new Map();
  const byName = new Map();

  for (const row of rankingRows) {
    const code = String(row.IdCountry ?? row.CountryCode ?? "").toLowerCase();
    if (code) byCode.set(code, row);

    for (const name of rankingNames(row)) {
      byName.set(normalizeName(name), row);
    }
  }

  return { byCode, byName };
}

function findRanking(team, rankingByCode) {
  return (
    rankingByCode.byCode.get(String(team.id ?? "").toLowerCase()) ??
    rankingByCode.byName.get(normalizeName(team.name)) ??
    null
  );
}

function rankingNames(row) {
  if (Array.isArray(row.TeamName)) {
    return row.TeamName.map((item) => item.Description).filter(Boolean);
  }

  return [row.Name, row.CountryName, row.TeamName].filter((value) => typeof value === "string");
}

function createLogScaler(values) {
  const logs = values.map((value) => Math.log1p(Math.max(0, value)));
  const min = Math.min(...logs);
  const max = Math.max(...logs);

  return (value) => {
    const logValue = Math.log1p(Math.max(0, value));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return DEFAULT_RATING;
    return SCORE_MIN + ((logValue - min) / (max - min)) * (SCORE_MAX - SCORE_MIN);
  };
}

function scoreFromRank(rank, maxRank) {
  if (!Number.isFinite(rank) || rank <= 0) return DEFAULT_RATING;
  const span = Math.max(1, maxRank - 1);
  return SCORE_MAX - ((rank - 1) / span) * (SCORE_MAX - SCORE_MIN);
}

function scoreFromMovement(value) {
  const movement = Number(value);
  if (!Number.isFinite(movement)) return DEFAULT_RATING;
  return clamp(DEFAULT_RATING + movement * 2, SCORE_MIN, SCORE_MAX);
}

function marketValueAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value && typeof value === "object") {
    const amount = Number(value.amount);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }
  return 0;
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampRating(value) {
  return Math.round(clamp(value, SCORE_MIN, SCORE_MAX));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
