// Looks up records by FormID and prints their type, editor ID and name.
//
//   node tools/extract/find-forms.ts "Starfield.esm|0x0475FA" "Starfield.esm|0x0546E1"
//   node tools/extract/find-forms.ts --from-dump QTYP      (every distinct QTYP value in quests.json)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { zstring } from "../esm/io.ts";
import { findRecords } from "../esm/plugin.ts";
import { loadPluginStrings, readLString } from "../esm/strings.ts";
import { officialPlugins, resolveGamePath } from "./game.ts";

const { values: args, positionals } = parseArgs({
  options: {
    game: { type: "string" },
    lang: { type: "string", default: "en" },
    "from-dump": { type: "string" },
    dump: { type: "string", default: "build/extract/quests.json" },
  },
  allowPositionals: true,
});

/** Distinct values of quest.refs[field] in the dump, with how many quests use each. */
function keysFromDump(field: string): Map<string, number> {
  const dump = JSON.parse(readFileSync(args.dump, "utf8")) as { quests: Array<{ refs: Record<string, string> }> };
  const counts = new Map<string, number>();
  for (const quest of dump.quests) {
    const key = quest.refs[field];
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

const usage = args["from-dump"] ? keysFromDump(args["from-dump"]) : new Map(positionals.map((key) => [key, 0]));
if (usage.size === 0) {
  console.error("Pass FormID keys like \"Starfield.esm|0x0475FA\" or --from-dump <FIELD>.");
  process.exit(1);
}

const gamePath = resolveGamePath(args.game);
const dataDir = join(gamePath, "Data");
const results = new Map<string, string[]>();

for (const plugin of officialPlugins(gamePath)) {
  // A plugin can only contain (or override) forms owned by itself or its masters.
  const owners = new Set([plugin.name, ...plugin.masters].map((name) => name.toLowerCase()));
  const wanted = new Set([...usage.keys()].filter((key) => owners.has(key.split("|")[0].toLowerCase())));
  if (wanted.size === 0) {
    continue;
  }

  const strings = plugin.localized ? loadPluginStrings(dataDir, plugin.name, args.lang) : new Map<number, string>();
  findRecords(plugin, wanted, (record, key) => {
    const editorId = record.subrecords.find((s) => s.type === "EDID");
    const name = record.subrecords.find((s) => s.type === "FULL");
    const line = [
      record.type,
      editorId ? zstring(editorId.data) : "",
      name ? `"${readLString(name.data, plugin, strings)}"` : "",
      `(${plugin.name})`,
    ].join("  ");
    results.set(key, [...(results.get(key) ?? []), line]);
  });
}

for (const [key, count] of [...usage].sort(([, a], [, b]) => b - a)) {
  const prefix = count > 0 ? `${String(count).padStart(5)}  ` : "";
  console.log(`${prefix}${key}  ${(results.get(key) ?? ["not found"]).join(" | ")}`);
}
