import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { teams } from "../src/data.js";

const outputDir = "assets/players";
const manifestPath = "src/playerPhotoManifest.js";
const concurrency = 8;

async function main() {
  await mkdir(outputDir, { recursive: true });

  const players = Object.values(teams)
    .flatMap((team) => team.players)
    .filter((player) => player.fifaId && player.photoUrl);
  const manifest = {};
  let downloaded = 0;
  let failed = 0;

  await runPool(players, concurrency, async (player) => {
    const fileName = `${player.fifaId}.jpg`;
    const relativeUrl = `/assets/players/${fileName}`;
    const filePath = join(outputDir, fileName);

    try {
      const response = await fetch(player.photoUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const bytes = new Uint8Array(await response.arrayBuffer());
      await writeFile(filePath, bytes);
      manifest[String(player.fifaId)] = relativeUrl;
      downloaded += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        `Failed to cache ${player.fifaId} ${player.name}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  });

  const contents = `export const localPlayerPhotosByFifaId = ${JSON.stringify(manifest, null, 2)};\n`;
  await writeFile(manifestPath, contents);

  console.log(`Cached ${downloaded}/${players.length} player photos. Failed: ${failed}.`);
}

async function runPool(items, limit, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });

  await Promise.all(workers);
}

await main();
