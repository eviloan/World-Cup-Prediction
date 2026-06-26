import { matches as localMatches, teams as localTeams, serializeMatch } from "./data.js";
import { buildKnockoutBracket } from "./bracket.js";
import { getFlagUrl } from "./flags.js";
import { formatDisplayName, formatMarketValue, formatStat } from "./formatters.js";
import { groupMatchesByDate, toggleFavoriteMatch } from "./matchSchedule.js";
import { nextUpcomingMatchId } from "./matchSelection.js";
import { canPredictMatch } from "./matchPredictionState.js";
import { matchResultsById, teamTournamentStatsById } from "./matchResultsData.js";
import { formatOddsValue, getChampionOdds, getMatchOdds } from "./odds.js";
import { localPlayerPhotosByFifaId } from "./playerPhotoManifest.js";
import { assistLeaderboard, enrichTeamsWithWorldCupStats, goalLeaderboard, playerWorldCupStatsSource } from "./playerWorldCupStats.js";
import { createLocalPrediction } from "./prediction.js";
import { groupPlayersByPosition } from "./roster.js";
import { buildGroupStandings } from "./standings.js";
import { enrichTeamsWithTransfermarkt } from "./transfermarktData.js";

const FAVORITES_STORAGE_KEY = "worldcup.favoriteMatches";
const initialMatches = localMatches.map(serializeMatch).map(enrichMatchResult);
const initialTeams = enrichTeamsWithStats(enrichTeamsWithWorldCupStats(enrichTeamsWithTransfermarkt(Object.values(localTeams))));
const initialMatchId = nextUpcomingMatchId(initialMatches) ?? initialMatches[0]?.id;
const initialMatch = initialMatches.find((match) => match.id === initialMatchId) ?? initialMatches[0];

const state = {
  activePage: "predict",
  matches: initialMatches,
  teams: initialTeams,
  selectedMatchId: initialMatchId,
  selectedTeamId: initialMatch?.homeTeamId ?? initialTeams[0]?.id,
  favoriteMatchIds: loadFavoriteMatchIds()
};

const elements = {
  apiStatus: document.querySelector("#api-status"),
  pageTabs: document.querySelectorAll("[data-page-tab]"),
  pageViews: document.querySelectorAll("[data-page]"),
  matchList: document.querySelector("#match-list"),
  selectedStage: document.querySelector("#selected-stage"),
  matchTitle: document.querySelector("#match-title"),
  matchMeta: document.querySelector("#match-meta"),
  scoreboard: document.querySelector("#scoreboard"),
  oddsPanel: document.querySelector("#odds-panel"),
  championOddsPanel: document.querySelector("#champion-odds-panel"),
  bracketBoard: document.querySelector("#bracket-board"),
  predictionControls: document.querySelector("#prediction-controls"),
  predictionClosed: document.querySelector("#prediction-closed"),
  rulesInput: document.querySelector("#rules-input"),
  predictButton: document.querySelector("#predict-button"),
  predictionResult: document.querySelector("#prediction-result"),
  playerLeaderboards: document.querySelector("#player-leaderboards"),
  teamTabs: document.querySelector("#team-tabs"),
  teamDetail: document.querySelector("#team-detail")
};

hydrateFromApi();
render();

elements.pageTabs.forEach((button) => {
  button.addEventListener("click", () => {
    state.activePage = button.dataset.pageTab;
    renderPage();
  });
});

elements.predictButton.addEventListener("click", async () => {
  const match = selectedMatch();
  if (!match) return;

  elements.predictButton.disabled = true;
  elements.predictButton.textContent = "预测中...";

  try {
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        rules: elements.rulesInput.value
      })
    });

    if (!response.ok) throw new Error("预测服务暂不可用");

    const body = await response.json();
    renderPrediction(body.prediction);
  } catch (error) {
    const prediction = createLocalPrediction(
      {
        id: match.id,
        stage: match.stage,
        kickoff: match.kickoff,
        venue: match.venue,
        homeTeamId: match.homeTeam.id,
        awayTeamId: match.awayTeam.id
      },
      localTeams,
      elements.rulesInput.value
    );
    renderPrediction({
      ...prediction,
      fallbackReason: error instanceof Error ? error.message : "浏览器端本地预测兜底"
    });
  } finally {
    elements.predictButton.disabled = false;
    elements.predictButton.textContent = "预测比分与胜平负";
  }
});

async function hydrateFromApi() {
  try {
    const response = await fetch("/api/worldcup");
    if (!response.ok) throw new Error("API unavailable");

    const data = await response.json();
    state.matches = data.matches.map(enrichMatchResult);
    state.teams = enrichTeamsWithStats(enrichTeamsWithWorldCupStats(enrichTeamsWithTransfermarkt(data.teams)));
    state.selectedMatchId = nextUpcomingMatchId(state.matches) ?? state.selectedMatchId ?? state.matches[0]?.id;
    const match = selectedMatch();
    state.selectedTeamId = match?.homeTeam?.id ?? state.selectedTeamId ?? state.teams[0]?.id;
    elements.apiStatus.textContent = "";
    render();
  } catch {
    elements.apiStatus.textContent = "本地数据";
  }
}

function render() {
  renderPage();
  renderMatches();
  renderSelectedMatch();
  renderTeams();
  renderChampionOdds();
  renderBracket();
}

function renderPage() {
  elements.pageTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.pageTab === state.activePage);
    button.classList.toggle("has-favorites", button.dataset.pageTab === "predict" && state.favoriteMatchIds.size > 0);
  });
  elements.pageViews.forEach((view) => {
    view.classList.toggle("active", view.dataset.page === state.activePage);
  });
}

function renderMatches() {
  elements.matchList.innerHTML = groupMatchesByDate(state.matches)
    .map(
      (group) => `
        <section class="match-date-group" aria-label="${group.label}">
          <div class="match-date-heading">
            <span>${group.label}</span>
            <small>${group.matches.length} 场</small>
          </div>
          <div class="match-date-list">
            ${group.matches.map((match) => matchRow(match)).join("")}
          </div>
        </section>
      `
    )
    .join("");

  elements.matchList.querySelectorAll("[data-match-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target.closest?.("[data-favorite-match-id]")) return;
      state.selectedMatchId = button.dataset.matchId;
      const match = selectedMatch();
      state.selectedTeamId = match?.homeTeam?.id ?? state.teams[0]?.id;
      elements.predictionResult.hidden = true;
      render();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      button.click();
    });
  });

  elements.matchList.querySelectorAll("[data-favorite-match-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.favoriteMatchIds = toggleFavoriteMatch(state.favoriteMatchIds, button.dataset.favoriteMatchId);
      saveFavoriteMatchIds(state.favoriteMatchIds);
      renderMatches();
      renderPage();
    });
  });

  elements.matchList.querySelector(".match-row.active")?.scrollIntoView({
    block: "center"
  });
}

function renderSelectedMatch() {
  const match = selectedMatch();
  if (!match) return;

  elements.selectedStage.textContent = match.stage;
  elements.matchTitle.textContent = `${teamNameForMatch(match, "home")} vs ${teamNameForMatch(match, "away")}`;
  elements.matchMeta.textContent = match.result
    ? `${formatDate(match.kickoff)} · 已完赛 ${match.result.homeScore}-${match.result.awayScore} · ${match.venue}`
    : `${formatDate(match.kickoff)} · ${match.venue}`;
  elements.scoreboard.innerHTML = `
    ${teamBlock(match.homeTeam, match.homePlaceholder)}
    <div class="score-divider">${scoreDivider(match)}</div>
    ${teamBlock(match.awayTeam, match.awayPlaceholder)}
  `;
  renderOdds(match);
  const canPredict = canPredictMatch(match);
  elements.predictionControls.hidden = !canPredict;
  elements.predictionClosed.hidden = !match.result;
  elements.predictionResult.hidden = !canPredict || elements.predictionResult.hidden;
  elements.predictButton.disabled = !canPredict;
  elements.predictButton.textContent = match.result
    ? "已完赛"
    : canPredict
      ? "预测比分与胜平负"
      : "该场对阵尚未确定";
}

function renderChampionOdds() {
  const championOdds = getChampionOdds();
  elements.championOddsPanel.innerHTML = `
    <div class="champion-odds-heading">
      <div>
        <p class="eyebrow">Tournament Odds</p>
        <h3>世界杯冠军赔率</h3>
      </div>
      <a href="${championOdds.sourceUrl}" target="_blank" rel="noreferrer">${championOdds.source}</a>
    </div>
    <div class="champion-odds-list">
      ${
        championOdds.items.length
          ? championOdds.items
              .map(
                (item) => `
                  <div class="champion-odds-row">
                    <span>${item.rank}</span>
                    <strong>${flagImage({ id: item.teamId, name: item.teamName })}${item.teamName}</strong>
                    <em>${formatOddsValue(item.odds)}</em>
                  </div>
                `
              )
              .join("")
          : `<p class="muted">等待冠军赔率同步</p>`
      }
    </div>
    <p class="odds-note">${championOdds.items[0]?.updatedText ?? "等待赔率源同步"}</p>
  `;
}

function renderBracket() {
  const rounds = buildKnockoutBracket(state.matches, state.teams);
  elements.bracketBoard.innerHTML = `
    <div class="bracket-track">
      ${rounds
        .map(
          (round) => `
            <section class="bracket-round" aria-label="${round.label}">
              <div class="bracket-round-title">
                <h3>${round.label}</h3>
                <span>${round.matches.length} 场</span>
              </div>
              <div class="bracket-match-list">
                ${round.matches.map((match) => bracketMatchCard(match)).join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function bracketMatchCard(match) {
  return `
    <article class="bracket-match ${match.status}" data-match-id="${match.id}">
      <div class="bracket-match-meta">
        <span>#${match.matchNumber}</span>
        <small>${formatDate(match.kickoff)}</small>
      </div>
      ${bracketSideRow(match.home)}
      ${bracketSideRow(match.away)}
      <div class="bracket-match-footer">
        <span>${match.score || "vs"}</span>
        <small>${match.venue || "Venue TBD"}</small>
      </div>
    </article>
  `;
}

function bracketSideRow(side) {
  return `
    <div class="bracket-side ${side.placeholder ? "placeholder" : ""} ${side.projected ? "projected" : ""} ${side.isWinner ? "winner" : ""}">
      <strong>
        ${side.team ? flagImage(side.team) : ""}${side.label}
        ${side.projected ? `<small>${side.sourceLabel}</small>` : ""}
      </strong>
      <span>${side.score ?? ""}</span>
    </div>
  `;
}

function renderOdds(match) {
  const odds = getMatchOdds(match);
  const updatedText = odds.updatedText || (odds.updatedAt ? `更新 ${formatDateTime(odds.updatedAt)}` : "等待赔率源同步");

  elements.oddsPanel.innerHTML = `
    <div class="odds-heading">
      <div>
        <p class="eyebrow">Market Odds</p>
        <h3>胜平负赔率</h3>
      </div>
      <a href="${odds.sourceUrl}" target="_blank" rel="noreferrer">${odds.source}</a>
    </div>
    <div class="odds-grid">
      ${odds.selections
        .map(
          (selection) => `
            <div class="odds-cell ${selection.value ? "" : "pending"}">
              <span>${selection.label}</span>
              <strong>${formatOddsValue(selection.value)}</strong>
              <small>${selection.team}</small>
            </div>
          `
        )
        .join("")}
    </div>
    <p class="odds-note">${updatedText}</p>
  `;
}

function renderTeams() {
  renderPlayerLeaderboards();
  elements.teamTabs.innerHTML = buildGroupStandings(state.teams)
    .map(
      ({ group, teams }) => `
        <section class="group-block standings-block" aria-label="${group} 积分榜">
          <div class="group-title">${group}</div>
          <div class="standings-table" role="table" aria-label="${group} standings">
            <div class="standings-row standings-head" role="row">
              <span role="columnheader">#</span>
              <span role="columnheader">球队</span>
              <span role="columnheader">赛</span>
              <span role="columnheader">胜</span>
              <span role="columnheader">平</span>
              <span role="columnheader">负</span>
              <span role="columnheader">净</span>
              <span role="columnheader">分</span>
            </div>
            ${teams
              .map((team, index) => {
                const active = team.id === state.selectedTeamId ? " active" : "";
                const stats = team.standings;
                return `
                  <button class="standings-row${active}" type="button" role="row" data-team-id="${team.id}">
                    <span role="cell">${index + 1}</span>
                    <strong role="cell">${flagImage(team)}<span>${team.name}</span></strong>
                    <span role="cell">${stats.played}</span>
                    <span role="cell">${stats.wins}</span>
                    <span role="cell">${stats.draws}</span>
                    <span role="cell">${stats.losses}</span>
                    <span role="cell">${formatSignedNumber(stats.goalDifference)}</span>
                    <span role="cell">${stats.points}</span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
      `
    )
    .join("");

  elements.teamTabs.querySelectorAll("[data-team-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTeamId = button.dataset.teamId;
      renderTeams();
    });
  });

  const team = state.teams.find((item) => item.id === state.selectedTeamId) ?? state.teams[0];
  if (!team) return;

  elements.teamDetail.innerHTML = `
    <div class="team-summary">
      <div class="team-heading">
        ${resolvedFlagUrl(team) ? `<img class="team-flag" src="${resolvedFlagUrl(team)}" alt="${team.name} flag" />` : ""}
        <div>
          <h3>${team.name}</h3>
          <p>${team.confederation} · ${team.group} · FIFA Rank ${team.fifaRank}</p>
        </div>
      </div>
      <dl class="metric-grid">
        <div><dt>进攻</dt><dd>${team.attack}</dd></div>
        <div><dt>防守</dt><dd>${team.defense}</dd></div>
        <div><dt>状态</dt><dd>${team.form}</dd></div>
        <div><dt>总身价</dt><dd>${formatMarketValue(team.marketValue)}</dd></div>
      </dl>
      ${teamTournamentSummary(team.currentTournamentStats)}
      <p class="market-source">身价、俱乐部和球员数据来源：${team.transfermarktSource?.name ?? "Transfermarkt"} 本地数据集。</p>
    </div>
    <div class="roster-sections">
      ${groupPlayersByPosition(team.players)
        .map(
          (group) => `
            <section class="roster-section" aria-label="${group.label}">
              <div class="roster-section-heading">
                <h4>${group.label}</h4>
                <span>${group.players.length} 人</span>
              </div>
              <div class="roster-grid">
                ${group.players.map((player) => playerCard(player)).join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function renderPlayerLeaderboards() {
  elements.playerLeaderboards.innerHTML = `
    ${leaderboardCard("世界杯进球榜", goalLeaderboard, "球")}
    ${leaderboardCard(
      "世界杯助攻榜",
      assistLeaderboard,
      "次",
      playerWorldCupStatsSource.assistsAvailable
        ? "暂无数据"
        : "FIFA 官方 live 数据暂未提供助攻球员字段，待官网同步后自动生成。"
    )}
    <p class="leaderboard-source">球员出场、进球、助攻、分钟数据来源：${playerWorldCupStatsSource.name} 官方比赛数据。</p>
  `;
}

function leaderboardCard(title, items, unit, emptyText = "暂无数据") {
  return `
    <section class="panel leaderboard-card" aria-label="${title}">
      <div class="leaderboard-title">
        <p class="eyebrow">Official Stats</p>
        <h3>${title}</h3>
      </div>
      <div class="leaderboard-list">
        ${
          items.length
            ? items
                .slice(0, 8)
                .map(
                  (item) => `
                    <div class="leaderboard-row">
                      <span>${item.rank}</span>
                      <strong>${flagImage({ id: item.teamId, name: item.teamName })}${formatDisplayName(item.name)}</strong>
                      <small>${item.teamName}</small>
                      <em>${item.value}${unit}</em>
                    </div>
                  `
                )
                .join("")
            : `<p class="muted">${emptyText}</p>`
        }
      </div>
    </section>
  `;
}

function matchRow(match) {
  const active = match.id === state.selectedMatchId ? " active" : "";
  const favorite = state.favoriteMatchIds.has(match.id) ? " favorite" : "";
  const homeName = teamNameForMatch(match, "home");
  const awayName = teamNameForMatch(match, "away");
  const favoriteLabel = state.favoriteMatchIds.has(match.id) ? "取消收藏" : "收藏比赛";
  const resultLabel = match.result ? `${match.result.homeScore}-${match.result.awayScore}` : "vs";
  return `
    <div class="match-row${active}${favorite}" role="button" tabindex="0" data-match-id="${match.id}">
      <div class="match-row-main">
        <span class="match-teams">
          <strong>${flagImage(match.homeTeam)}${homeName}</strong>
          <span class="versus ${match.result ? "finished-score" : ""}">${resultLabel}</span>
          <strong>${flagImage(match.awayTeam)}${awayName}</strong>
        </span>
        <small>#${match.matchNumber ?? ""} · ${match.stage} · ${formatTime(match.kickoff)} 北京时间</small>
      </div>
      <button
        class="favorite-button"
        type="button"
        aria-label="${favoriteLabel}"
        aria-pressed="${state.favoriteMatchIds.has(match.id)}"
        title="${favoriteLabel}"
        data-favorite-match-id="${match.id}"
      >
        ★
      </button>
    </div>
  `;
}

function playerCard(player) {
  return `
    <article class="player-card">
      ${
        playerPhotoUrl(player)
          ? `<img class="player-photo" src="${playerPhotoUrl(player)}" alt="${formatDisplayName(player.name)}" loading="lazy" />`
          : `<div class="player-photo placeholder">${player.position || "?"}</div>`
      }
      <div class="player-card-body">
        <div class="player-title">
          <span>${player.jerseyNumber ? `${player.jerseyNumber}. ` : ""}${formatDisplayName(player.name)}</span>
          <strong>${formatMarketValue(player.marketValue)}</strong>
        </div>
        ${playerInfo(player)}
        <dl class="player-stats">
          <div><dt>出场</dt><dd>${formatStat(player.stats?.appearances)}</dd></div>
          <div><dt>进球</dt><dd>${formatStat(player.stats?.goals)}</dd></div>
          <div><dt>助攻</dt><dd>${formatStat(player.stats?.assists)}</dd></div>
          <div><dt>分钟</dt><dd>${formatStat(player.stats?.minutesPlayed)}</dd></div>
        </dl>
        ${
          player.transfermarktUrl
            ? `<a class="market-link" href="${player.transfermarktUrl}" target="_blank" rel="noreferrer">Transfermarkt</a>`
            : `<span class="market-link muted-link">Transfermarkt 待补</span>`
        }
      </div>
    </article>
  `;
}

function renderPrediction(prediction) {
  elements.predictionResult.hidden = false;
  elements.predictionResult.innerHTML = `
    <div class="prediction-head">
      <div>
        <p class="eyebrow">${prediction.source === "mimo" ? "MiMo AI" : "Local Rules"}</p>
        <h3>预测比分 ${prediction.predictedScore}</h3>
      </div>
      ${prediction.fallbackReason ? `<span class="source-note">${fallbackLabel(prediction.fallbackReason)}</span>` : ""}
    </div>
    <div class="score-options">
      ${(prediction.scoreOptions ?? [{ score: prediction.predictedScore }])
        .slice(0, 3)
        .map(
          (option, index) => `
            <div class="score-option${index === 0 ? " primary" : ""}">
              <span>${index === 0 ? "首选" : `备选 ${index}`}</span>
              <strong>${option.score}</strong>
              ${option.probability ? `<small>${option.probability}%</small>` : ""}
            </div>
          `
        )
        .join("")}
    </div>
    <div class="probability-list">
      ${probabilityBar("主胜", prediction.probabilities.homeWin)}
      ${probabilityBar("平局", prediction.probabilities.draw)}
      ${probabilityBar("客胜", prediction.probabilities.awayWin)}
    </div>
    <ul class="reasoning">
      ${prediction.reasoning.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function fallbackLabel(reason) {
  if (String(reason).includes("MIMO_API_KEY")) {
    return "未配置 MiMo，已使用本地规则预测";
  }
  return reason;
}

function selectedMatch() {
  return state.matches.find((match) => match.id === state.selectedMatchId);
}

function enrichMatchResult(match) {
  const result = matchResultsById[match.id] ?? null;
  return result ? { ...match, result } : match;
}

function enrichTeamsWithStats(teams) {
  return teams.map((team) => ({
    ...team,
    currentTournamentStats: teamTournamentStatsById[team.id] ?? null
  }));
}

function teamBlock(team, placeholder = "") {
  if (!team) {
    return `
      <div class="team-block placeholder-team">
        <span class="team-code">TBD</span>
        <strong>${placeholder || "待定"}</strong>
        <small>淘汰赛席位尚未确定</small>
      </div>
    `;
  }

  return `
    <div class="team-block">
      ${resolvedFlagUrl(team) ? `<img class="score-flag" src="${resolvedFlagUrl(team)}" alt="${team.name} flag" />` : ""}
      <span class="team-code">${team.id.toUpperCase()}</span>
      <strong>${team.name}</strong>
      <small>Rank ${team.fifaRank} · ${team.coach}</small>
    </div>
  `;
}

function scoreDivider(match) {
  return match.result ? `${match.result.homeScore}-${match.result.awayScore}` : "VS";
}

function teamTournamentSummary(stats) {
  if (!stats?.played) return "";

  return `
    <dl class="tournament-stats">
      <div><dt>本届</dt><dd>${stats.played} 场</dd></div>
      <div><dt>积分</dt><dd>${stats.points}</dd></div>
      <div><dt>胜平负</dt><dd>${stats.wins}-${stats.draws}-${stats.losses}</dd></div>
      <div><dt>进失球</dt><dd>${stats.goalsFor}-${stats.goalsAgainst}</dd></div>
      <div><dt>净胜球</dt><dd>${stats.goalDifference}</dd></div>
      <div><dt>走势</dt><dd>${stats.form.join("")}</dd></div>
    </dl>
  `;
}

function teamNameForMatch(match, side) {
  const team = side === "home" ? match.homeTeam : match.awayTeam;
  const placeholder = side === "home" ? match.homePlaceholder : match.awayPlaceholder;
  return team?.name ?? placeholder ?? "待定";
}

function playerInfo(player) {
  return `
    <div class="player-info">
      <div class="player-club">
        <span>俱乐部</span>
        <strong>${player.club || "0"}</strong>
      </div>
      <dl class="player-bio">
        <div>
          <dt>位置</dt>
          <dd>${player.positionLabel || player.position || "0"}</dd>
        </div>
        <div>
          <dt>身高</dt>
          <dd>${formatStat(player.heightCm)}cm</dd>
        </div>
        <div>
          <dt>体重</dt>
          <dd>${formatStat(player.weightKg)}kg</dd>
        </div>
      </dl>
    </div>
  `;
}

function playerPhotoUrl(player) {
  return localPlayerPhotosByFifaId[String(player.fifaId)] || "";
}

function flagImage(team) {
  const flagUrl = resolvedFlagUrl(team);
  if (!flagUrl) return "";
  return `<img class="inline-flag" src="${flagUrl}" alt="${team.name} flag" loading="lazy" />`;
}

function formatSignedNumber(value) {
  const numeric = Number(value) || 0;
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function resolvedFlagUrl(team) {
  if (!team?.id) return "";
  return getFlagUrl(team.id) || team.flagUrl || "";
}

function probabilityBar(label, value) {
  return `
    <div class="probability-row">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width: ${value}%"></div></div>
      <strong>${value}%</strong>
    </div>
  `;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(new Date(value)) + " 北京时间";
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(new Date(value)) + " 北京时间";
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(new Date(value));
}

function loadFavoriteMatchIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveFavoriteMatchIds(favorites) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favorites]));
  } catch {
    // 收藏只是本地增强功能，存储不可用时不影响页面使用。
  }
}
