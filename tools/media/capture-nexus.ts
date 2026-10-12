// Captures the Nexus Mods media from the built menu (npm run build:mod first): the header banner
// (1300x372, tools/media/banner.html) and gallery screenshots (1920x1080) of the menu in its
// preview "showcase" mode. Uses headless Edge (or Chrome). Output: dist/nexus-media/*.png, which
// contain the game's icons, so they are not committed.
//
//   node tools/media/capture-nexus.ts

import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const viewDir = join(repo, "build/mod/SFSE/Plugins/OSF/UI/views/completionist/menu");
const outDir = join(repo, "dist/nexus-media");
const port = 5174;
const base = `http://localhost:${port}/`;

const browser = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find(existsSync);
if (!browser) throw new Error("Edge or Chrome is needed for the captures");
if (!existsSync(join(viewDir, "index.html"))) throw new Error("Build the menu first: npm run build:mod");

// One shot per gallery image: file name and the preview's URL options (see the demo block in app.js).
const story = "No Sudden Moves";
const shots: Array<[string, Record<string, string>]> = [
  ["01-log-tracked-objectives", { tab: "log", sel: story, open: story, track: story }],
  ["02-here-city", { here: "New Atlantis", tab: "here", track: story }],
  ["03-here-planet", { here: "Jemison", tab: "here", survey: "0.63" }],
  ["04-quests-main-story", { tab: "questlines", place: "Main Missions", sel: story, open: story, track: story }],
  ["05-locations", { tab: "locations", place: "Akila City" }],
  ["06-side-quests", { tab: "side", place: "All side quests" }],
  ["07-activities", { tab: "activities", place: "All activities" }],
  ["08-nothing-here", { here: "none", tab: "here" }],
  ["09-spoilers-hidden", { tab: "locations", place: "Dazra", spoilers: "1" }],
];

mkdirSync(outDir, { recursive: true });
copyFileSync(join(repo, "tools/media/banner.html"), join(viewDir, "_banner.html"));
const server = spawn(process.execPath, [join(repo, "tools/dev/serve-menu.ts")], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
const profile = mkdtempSync(join(tmpdir(), "completionist-capture-"));

function capture(file: string, url: string, width: number, height: number) {
  const out = join(outDir, file + ".png");
  const result = spawnSync(browser!, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--user-data-dir=${profile}`, `--window-size=${width},${height}`, "--virtual-time-budget=5000",
    `--screenshot=${out}`, url,
  ], { stdio: "ignore", timeout: 60000 });
  console.log(`${existsSync(out) && result.status === 0 ? "ok  " : "FAIL"} ${file}.png`);
}

try {
  await new Promise((resolve) => setTimeout(resolve, 1500)); // let the server start
  capture("00-header-1300x372", base + "_banner.html", 1300, 372);
  for (const [file, options] of shots) {
    capture(file, base + "?" + new URLSearchParams({ showcase: "1", ...options }).toString(), 1920, 1080);
  }
} finally {
  server.kill();
  rmSync(join(viewDir, "_banner.html"), { force: true });
  rmSync(profile, { recursive: true, force: true });
}
console.log(`Media: ${outDir}`);
