import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readPluginHeader, type PluginHeader } from "../esm/plugin.ts";

const DEFAULT_GAME_PATHS = [
  "C:/Program Files (x86)/Steam/steamapps/common/Starfield",
  "C:/Program Files/Steam/steamapps/common/Starfield",
];

// Bethesda's own masters: base game, Premium content, DLC and update/Creation masters.
const OFFICIAL_PLUGIN = /^(Starfield|Constellation|OldMars|ShatteredSpace|BlueprintShips-[\w-]+|SFBGS[0-9A-F]{3})\.esm$/i;

export function resolveGamePath(explicit?: string): string {
  const candidates = [explicit, process.env.STARFIELD_PATH, ...DEFAULT_GAME_PATHS];
  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, "Data", "Starfield.esm"))) {
      return candidate;
    }
  }
  throw new Error("Couldn't find Starfield. Pass --game <path> or set STARFIELD_PATH.");
}

/** Official masters present in Data, ordered so every plugin comes after its masters. */
export function officialPlugins(gamePath: string): PluginHeader[] {
  const dataDir = join(gamePath, "Data");
  const headers = readdirSync(dataDir)
    .filter((file) => OFFICIAL_PLUGIN.test(file))
    .map((file) => readPluginHeader(join(dataDir, file)));

  // Some plugins list masters in lower case ("starfield.esm"); use the file's real
  // name so FormID keys from different plugins compare equal.
  const fileNames = new Map(headers.map((header) => [header.name.toLowerCase(), header.name]));
  for (const header of headers) {
    header.masters = header.masters.map((master) => fileNames.get(master.toLowerCase()) ?? master);
  }
  return sortByMasters(headers);
}

function sortByMasters(headers: PluginHeader[]): PluginHeader[] {
  const byName = new Map(headers.map((header) => [header.name.toLowerCase(), header]));
  const sorted: PluginHeader[] = [];
  const visited = new Set<string>();

  const visit = (header: PluginHeader): void => {
    const key = header.name.toLowerCase();
    if (visited.has(key)) {
      return;
    }
    visited.add(key);
    for (const master of header.masters) {
      const dependency = byName.get(master.toLowerCase());
      if (dependency) {
        visit(dependency);
      }
    }
    sorted.push(header);
  };

  const isBase = (header: PluginHeader): number => (header.name.toLowerCase() === "starfield.esm" ? 0 : 1);
  [...headers].sort((a, b) => isBase(a) - isBase(b) || a.name.localeCompare(b.name)).forEach(visit);
  return sorted;
}
