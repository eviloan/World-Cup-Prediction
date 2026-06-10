import { matches as localMatches, teams as localTeams, serializeMatch } from "./data.js";
import { getFlagUrl } from "./flags.js";
import { formatDisplayName, formatMarketValue, formatStat } from "./formatters.js";
import { groupMatchesByDate, toggleFavoriteMatch } from "./matchSchedule.js";
import { localPlayerPhotosByFifaId } from "./playerPhotoManifest.js";
import { createLocalPrediction } from "./prediction.js";
import { groupPlayersByPosition } from "./roster.js";
import { enrichTeamsWithTransfermarkt } from "./transfermarktData.js";

const FAVORITES_STORAGE_KEY = "worldcup.favoriteMatches";

const state = {
  activePage: "predict",
  matches: localMatches.map(serializeMatch),
  teams: enrichTeamsWithTransfermarkt(Object.values(localTeams)),
  selectedMatchId: localMatches[0]?.id,
  selectedTeamId: localMatches[0]?.homeTeamId,
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
  rulesInput: document.querySelector("#rules-input"),
  predictButton: document.querySelector("#predict-button"),
  predictionResult: document.querySelector("#prediction-result"),
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
    state.matches = data.matches;
    state.teams = enrichTeamsWithTransfermarkt(data.teams);
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
}

function renderSelectedMatch() {
  const match = selectedMatch();
  if (!match) return;

  elements.selectedStage.textContent = match.stage;
  elements.matchTitle.textContent = `${teamNameForMatch(match, "home")} vs ${teamNameForMatch(match, "away")}`;
  elements.matchMeta.textContent = `${formatDate(match.kickoff)} · ${match.venue}`;
  elements.scoreboard.innerHTML = `
    ${teamBlock(match.homeTeam, match.homePlaceholder)}
    <div class="score-divider">VS</div>
    ${teamBlock(match.awayTeam, match.awayPlaceholder)}
  `;
  const canPredict = Boolean(match.homeTeam && match.awayTeam);
  elements.predictButton.disabled = !canPredict;
  elements.predictButton.textContent = canPredict ? "预测比分与胜平负" : "该场对阵尚未确定";
}

function renderTeams() {
  elements.teamTabs.innerHTML = groupedTeams()
    .map(
      ([group, teams]) => `
        <div class="group-block">
          <div class="group-title">${group}</div>
          <div class="group-teams">
            ${teams
              .map((team) => {
                const active = team.id === state.selectedTeamId ? " active" : "";
                return `
                  <button class="team-tab${active}" type="button" data-team-id="${team.id}">
                    ${flagImage(team)}
                    <span>${team.name}</span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
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

function matchRow(match) {
  const active = match.id === state.selectedMatchId ? " active" : "";
  const favorite = state.favoriteMatchIds.has(match.id) ? " favorite" : "";
  const homeName = teamNameForMatch(match, "home");
  const awayName = teamNameForMatch(match, "away");
  const favoriteLabel = state.favoriteMatchIds.has(match.id) ? "取消收藏" : "收藏比赛";
  return `
    <div class="match-row${active}${favorite}" role="button" tabindex="0" data-match-id="${match.id}">
      <div class="match-row-main">
        <span class="match-teams">
          <strong>${flagImage(match.homeTeam)}${homeName}</strong>
          <span class="versus">vs</span>
          <strong>${flagImage(match.awayTeam)}${awayName}</strong>
        </span>
        <small>#${match.matchNumber ?? ""} · ${match.stage} · ${formatTime(match.kickoff)}</small>
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

function groupedTeams() {
  const collator = new Intl.Collator("en");
  const groups = new Map();

  for (const team of state.teams) {
    const group = team.group || "Unassigned";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(team);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([group, teams]) => [group, teams.sort((a, b) => collator.compare(a.name, b.name))]);
}

function flagImage(team) {
  const flagUrl = resolvedFlagUrl(team);
  if (!flagUrl) return "";
  return `<img class="inline-flag" src="${flagUrl}" alt="${team.name} flag" loading="lazy" />`;
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
    minute: "2-digit"
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
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
