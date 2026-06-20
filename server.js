import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { matches, teams } from "./src/data.js";
import { matchResultsById } from "./src/matchResultsData.js";
import { predictMatch } from "./src/prediction.js";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const publicTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

export function createServer(options = {}) {
  const config = {
    kimiApiKey: options.kimiApiKey ?? process.env.MIMO_API_KEY ?? process.env.KIMI_API_KEY ?? "",
    kimiBaseUrl:
      options.kimiBaseUrl ??
      process.env.MIMO_BASE_URL ??
      process.env.KIMI_BASE_URL ??
      "https://api.xiaomimimo.com/v1/chat/completions",
    kimiModel: options.kimiModel ?? process.env.MIMO_MODEL ?? process.env.KIMI_MODEL ?? "mimo-v2.5-pro",
    presetRules: options.presetRules,
    presetRulesPath: options.presetRulesPath ?? join(rootDir, "prediction-rules.md"),
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    teams: options.teams ?? teams,
    matches: options.matches ?? matches
  };

  return createHttpServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/api/worldcup") {
        sendJson(response, {
          matches: config.matches.map((match) => serializeMatchWithTeams(match, config.teams)),
          teams: Object.values(config.teams)
        });
        return;
      }

      if (request.method === "POST" && request.url === "/api/predict") {
        const body = await readJsonBody(request);
        const match = config.matches.find((item) => item.id === body.matchId);

        if (!match) {
          sendJson(response, { error: "Unknown matchId." }, 404);
          return;
        }

        if (!match.homeTeamId || !match.awayTeamId) {
          sendJson(response, { error: "Match teams are not confirmed yet." }, 422);
          return;
        }

        const presetRules =
          config.presetRules ?? (await readPresetRules(config.presetRulesPath));
        const prediction = await predictMatch({
          match,
          teams: config.teams,
          rules: String(body.rules ?? ""),
          presetRules,
          kimiApiKey: config.kimiApiKey,
          kimiBaseUrl: config.kimiBaseUrl,
          kimiModel: config.kimiModel,
          fetchImpl: config.fetchImpl
        });

        sendJson(response, { prediction });
        return;
      }

      if (request.method === "GET" || request.method === "HEAD") {
        await serveStatic(request, response);
        return;
      }

      sendJson(response, { error: "Method not allowed." }, 405);
    } catch (error) {
      sendJson(
        response,
        { error: error instanceof Error ? error.message : "Unexpected server error." },
        500
      );
    }
  });
}

async function readPresetRules(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return "";
    throw error;
  }
}

function serializeMatchWithTeams(match, teamMap) {
  const home = match.homeTeamId ? teamMap[match.homeTeamId] : null;
  const away = match.awayTeamId ? teamMap[match.awayTeamId] : null;

  return {
    ...match,
    result: matchResultsById[match.id] ?? null,
    homeTeam: home,
    awayTeam: away
  };
}

async function readJsonBody(request) {
  let raw = "";

  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 100_000) {
      throw new Error("Request body is too large.");
    }
  }

  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(request, response) {
  const url = new URL(request.url, "http://localhost");
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    sendJson(response, { error: "Forbidden." }, 403);
    return;
  }

  try {
    await access(filePath);
  } catch {
    sendJson(response, { error: "Not found." }, 404);
    return;
  }

  const extension = extname(filePath);
  const headers = {
    "Content-Type": publicTypes[extension] ?? "application/octet-stream"
  };
  if ([".css", ".html", ".js"].includes(extension)) {
    headers["Cache-Control"] = "no-store";
  }

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port, () => {
    console.log(`WorldCup AI Predictor running at http://localhost:${port}`);
  });
}
