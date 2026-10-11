// Localized string tables (.STRINGS / .DLSTRINGS / .ILSTRINGS) for localized plugins.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { openBa2, readBa2Entry } from "./ba2.ts";
import { zstring } from "./io.ts";
import type { PluginHeader } from "./plugin.ts";

export type StringTable = Map<number, string>;

/** Reads a FULL-style field: a string ID in localized plugins, inline text otherwise. */
export function readLString(data: Buffer, plugin: PluginHeader, strings: StringTable): string {
  if (!plugin.localized) {
    return zstring(data);
  }
  if (data.length < 4) {
    return "";
  }
  const id = data.readUInt32LE(0);
  return id === 0 ? "" : (strings.get(id) ?? `<missing string ${id}>`);
}

function parseStringTable(data: Buffer, lengthPrefixed: boolean): StringTable {
  const count = data.readUInt32LE(0);
  const dataStart = 8 + count * 8;
  const table: StringTable = new Map();
  for (let i = 0; i < count; i++) {
    const id = data.readUInt32LE(8 + i * 8);
    let start = dataStart + data.readUInt32LE(12 + i * 8);
    let end: number;
    if (lengthPrefixed) {
      const length = data.readUInt32LE(start);
      start += 4;
      end = start + length;
    } else {
      end = data.indexOf(0, start);
    }
    table.set(id, data.toString("utf8", start, end).replace(/\0$/, ""));
  }
  return table;
}

/**
 * Loads all string tables for a plugin, looking in loose Data/Strings first and
 * then in the plugin's own archives ("<Plugin> - *.ba2").
 */
export function loadPluginStrings(dataDir: string, pluginName: string, language = "en"): StringTable {
  const base = pluginName.replace(/\.(esm|esp|esl)$/i, "").toLowerCase();
  const kinds: Array<[string, boolean]> = [
    ["strings", false],
    ["dlstrings", true],
    ["ilstrings", true],
  ];
  const wanted = new Map(kinds.map(([ext, prefixed]) => [`strings/${base}_${language}.${ext}`, prefixed]));
  const found = new Map<string, Buffer>();

  for (const name of wanted.keys()) {
    const loose = join(dataDir, name);
    if (existsSync(loose)) {
      found.set(name, readFileSync(loose));
    }
  }

  if (found.size < wanted.size) {
    // Localization archives first: they're small and usually all we need.
    const archives = readdirSync(dataDir)
      .filter((file) => file.toLowerCase().startsWith(`${base} - `) && file.toLowerCase().endsWith(".ba2"))
      .sort((a, b) => Number(b.toLowerCase().includes("localization")) - Number(a.toLowerCase().includes("localization")));
    for (const file of archives) {
      if (found.size === wanted.size) {
        break;
      }
      const archive = openBa2(join(dataDir, file));
      if (!archive) {
        continue;
      }
      for (const entry of archive.entries) {
        if (wanted.has(entry.name) && !found.has(entry.name)) {
          found.set(entry.name, readBa2Entry(archive, entry));
        }
      }
    }
  }

  const merged: StringTable = new Map();
  for (const [name, prefixed] of wanted) {
    const data = found.get(name);
    if (!data) {
      continue;
    }
    for (const [id, text] of parseStringTable(data, prefixed)) {
      if (!merged.has(id)) {
        merged.set(id, text);
      }
    }
  }
  return merged;
}
