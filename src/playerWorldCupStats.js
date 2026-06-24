import {
  assistLeaderboard,
  goalLeaderboard,
  playerWorldCupStatsByFifaId,
  playerWorldCupStatsSource
} from "./playerWorldCupStatsData.js";

export { assistLeaderboard, goalLeaderboard, playerWorldCupStatsSource };

export function enrichTeamsWithWorldCupStats(teams, statsByFifaId = playerWorldCupStatsByFifaId) {
  return teams.map((team) => ({
    ...team,
    players: (team.players ?? []).map((player) => ({
      ...player,
      stats: statsByFifaId[String(player.fifaId)]?.stats ?? player.stats ?? zeroStats()
    }))
  }));
}

function zeroStats() {
  return {
    appearances: 0,
    goals: 0,
    assists: 0,
    minutesPlayed: 0
  };
}
