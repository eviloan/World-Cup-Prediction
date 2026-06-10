import { getFlagUrl } from "./flags.js";

export const FIFA_COMPETITION_ID = "17";
export const FIFA_2026_SEASON_ID = "285023";

const DEFAULT_RATING = 72;

export function transformFifaData({ teamsPayload, squadsByTeamId, matchesPayload }) {
  const rawTeams = teamsPayload.Results ?? [];
  const teams = Object.fromEntries(
    rawTeams.map((team) => {
      const id = normalizeTeamId(team);
      return [
        id,
        transformTeam(team, squadsByTeamId[team.IdTeam] ?? null)
      ];
    })
  );

  const matches = (matchesPayload.Results ?? [])
    .slice()
    .sort((a, b) => Number(a.MatchNumber ?? 0) - Number(b.MatchNumber ?? 0))
    .map(transformMatch);
  applyGroupsFromMatches(teams, matches);

  return { teams, matches };
}

export function transformTeam(team, squad) {
  const coach = (squad?.Officials ?? []).find((official) => official.Role === 0);
  const id = normalizeTeamId(team);
  const fifaFlagUrl = materializeFifaPictureUrl(team.PictureUrl);

  return {
    id,
    fifaId: team.IdTeam,
    name: localized(team.Name) || team.ShortClubName || team.Abbreviation,
    group: "",
    confederation: team.IdConfederation ?? "",
    fifaRank: 50,
    attack: DEFAULT_RATING,
    defense: DEFAULT_RATING,
    form: DEFAULT_RATING,
    coach: coach ? localized(coach.Alias) || localized(coach.Name) : "",
    flagUrl: getFlagUrl(id) || fifaFlagUrl,
    fifaFlagUrl,
    players: (squad?.Players ?? []).map(transformPlayer)
  };
}

export function transformMatch(match) {
  return {
    id: match.IdMatch,
    matchNumber: match.MatchNumber,
    stage: localized(match.GroupName) || localized(match.StageName) || "Match",
    stageName: localized(match.StageName) || "",
    groupName: localized(match.GroupName) || "",
    kickoff: match.Date,
    localKickoff: match.LocalDate,
    venue: [localized(match.Stadium?.Name), localized(match.Stadium?.CityName)]
      .filter(Boolean)
      .join(", "),
    homeTeamId: match.Home ? normalizeTeamId(match.Home) : null,
    awayTeamId: match.Away ? normalizeTeamId(match.Away) : null,
    homePlaceholder: match.PlaceHolderA ?? "",
    awayPlaceholder: match.PlaceHolderB ?? ""
  };
}

function transformPlayer(player) {
  return {
    fifaId: player.IdPlayer,
    name: localized(player.PlayerName),
    shortName: localized(player.ShortName),
    jerseyNumber: player.JerseyNum,
    position: positionCode(player.Position),
    positionLabel: localized(player.PositionLocalized),
    club: "",
    birthDate: player.BirthDate,
    heightCm: player.Height ?? null,
    weightKg: player.Weight ?? null,
    photoUrl:
      player.PlayerPicture?.PictureUrl ??
      materializeFifaPictureUrl(player.PictureUrl) ??
      materializeFifaPictureUrl(player.ThumbnailUrl)
  };
}

function localized(value) {
  if (!Array.isArray(value)) return "";
  return (
    value.find((item) => item.Locale === "en-GB")?.Description ??
    value.find((item) => item.Description)?.Description ??
    ""
  );
}

function normalizeTeamId(team) {
  return String(team.Abbreviation ?? team.IdCountry ?? team.IdAssociation ?? team.IdTeam).toLowerCase();
}

function positionCode(position) {
  return ["GK", "DF", "MF", "FW"][Number(position)] ?? "";
}

function materializeFifaPictureUrl(url) {
  if (!url) return "";
  return url.replace("{format}", "png").replace("{size}", "l");
}

function applyGroupsFromMatches(teams, matches) {
  for (const match of matches) {
    if (!match.groupName) continue;
    if (match.homeTeamId && teams[match.homeTeamId]) teams[match.homeTeamId].group = match.groupName;
    if (match.awayTeamId && teams[match.awayTeamId]) teams[match.awayTeamId].group = match.groupName;
  }
}
