// Extracts the game's faction / mission icons from interface/factions.swf (in
// "Starfield - Interface.ba2") as SVG files under build/icons/. They are Bethesda's art:
// generated from the player's own game files at build time and never committed.
//
//   node tools/extract/extract-icons.ts [--game <Starfield folder>]

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { openBa2, readBa2Entry } from "../esm/ba2.ts";
import { resolveGamePath } from "./game.ts";
import { readSwf, symbolToSvg } from "./swf.ts";

const { values: args } = parseArgs({ options: { game: { type: "string" } } });
const repo = fileURLToPath(new URL("../../", import.meta.url));
const outDir = join(repo, "build/icons");

const archive = openBa2(join(resolveGamePath(args.game), "Data", "Starfield - Interface.ba2"));
const entry = archive?.entries.find((e) => e.name === "interface/factions.swf");
if (!archive || !entry) throw new Error("interface/factions.swf not found in Starfield - Interface.ba2");
const swf = readSwf(readBa2Entry(archive, entry));

mkdirSync(outDir, { recursive: true });
let count = 0;
for (const [symbol, id] of swf.symbols) {
  // "ConstellationColorIcon" -> constellation-color.svg, "ConstellationIcon" -> constellation.svg
  const name = symbol.replace(/Icon$/, "").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  writeFileSync(join(outDir, name + ".svg"), symbolToSvg(swf, id, name.replace(/-/g, "") + "_"));
  count++;
}
console.log(`${count} icons -> ${outDir}`);
