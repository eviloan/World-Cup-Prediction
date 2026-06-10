const COUNTRY_ALIASES = new Map([
  ["cabo verde", "cape verde"],
  ["cote d ivoire", "ivory coast"],
  ["côte d ivoire", "ivory coast"],
  ["ir iran", "iran"],
  ["korea republic", "south korea"],
  ["turkiye", "turkey"],
  ["türkiye", "turkey"],
  ["usa", "united states"],
  ["congo dr", "dr congo"],
  ["czechia", "czech republic"]
]);

export function normalizePersonName(value) {
  return normalizeText(value)
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeCountryName(value) {
  const normalized = normalizePersonName(value);
  return COUNTRY_ALIASES.get(normalized) ?? normalized;
}

export function buildTransfermarktProfiles({ teams, playerRows, valuationRows = [] }) {
  const fifaPlayers = buildFifaPlayerIndex(teams);
  const matchedByTransfermarktId = new Map();
  const playersByFifaId = {};

  for (const row of playerRows) {
    const match = findFifaPlayer(row, fifaPlayers);
    if (!match) continue;

    const transfermarktId = String(row.player_id ?? "");
    if (!transfermarktId) continue;

    const profile = {
      transfermarktId,
      marketValue: marketValue(row.market_value_in_eur),
      highestMarketValue: marketValue(row.highest_market_value_in_eur),
      club: row.current_club_name ?? "",
      stats: { appearances: 0, goals: 0, assists: 0, minutesPlayed: 0 },
      transfermarktUrl: row.url ?? ""
    };

    playersByFifaId[match.fifaId] = profile;
    matchedByTransfermarktId.set(transfermarktId, {
      fifaId: match.fifaId,
      latestValuation: row.market_value_in_eur ? { date: "", amount: Number(row.market_value_in_eur) } : null
    });
  }

  for (const row of valuationRows) {
    const matched = matchedByTransfermarktId.get(String(row.player_id ?? ""));
    if (!matched) continue;

    const amount = Number(row.market_value_in_eur);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const currentDate = row.date ?? "";
    if (!matched.latestValuation || currentDate >= matched.latestValuation.date) {
      matched.latestValuation = { date: currentDate, amount };
      playersByFifaId[matched.fifaId].marketValue = { amount, currency: "EUR" };
    }
  }

  return {
    playersByFifaId,
    summary: {
      fifaPlayers: fifaPlayers.entries.length,
      matchedPlayers: Object.keys(playersByFifaId).length
    }
  };
}

function buildFifaPlayerIndex(teams) {
  const entries = Object.values(teams).flatMap((team) =>
    team.players.map((player) => ({
      fifaId: String(player.fifaId),
      name: normalizePersonName(player.name),
      country: normalizeCountryName(team.name),
      birthDate: datePart(player.birthDate)
    }))
  );

  const byCountryNameBirth = new Map();
  const byCountryName = new Map();

  for (const entry of entries) {
    appendMapValue(byCountryNameBirth, key(entry.country, entry.name, entry.birthDate), entry);
    appendMapValue(byCountryName, key(entry.country, entry.name), entry);
  }

  return { entries, byCountryNameBirth, byCountryName };
}

function findFifaPlayer(row, fifaPlayers) {
  const country = normalizeCountryName(row.country_of_citizenship);
  const name = normalizePersonName(row.name);
  const birthDate = datePart(row.date_of_birth);
  const exact = onlyValue(fifaPlayers.byCountryNameBirth.get(key(country, name, birthDate)));
  if (exact) return exact;

  return onlyValue(fifaPlayers.byCountryName.get(key(country, name)));
}

function appendMapValue(map, keyName, value) {
  if (!map.has(keyName)) map.set(keyName, []);
  map.get(keyName).push(value);
}

function onlyValue(values) {
  return values?.length === 1 ? values[0] : null;
}

function key(...parts) {
  return parts.join("|");
}

function datePart(value) {
  return String(value ?? "").slice(0, 10);
}

function marketValue(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? { amount, currency: "EUR" } : "";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
