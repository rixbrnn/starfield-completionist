// Dumps every QUST record from the official masters to build/extract/quests.json
// and prints a summary grouped by quest type (spike S2).
//
//   node tools/extract/dump-quests.ts [--game <Starfield folder>] [--out <file>] [--lang en]

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { zstring } from "../esm/io.ts";
import { forEachRecord, formKey, type PluginHeader, type PluginRecord } from "../esm/plugin.ts";
import { loadPluginStrings, readLString, type StringTable } from "../esm/strings.ts";
import { officialPlugins, resolveGamePath } from "./game.ts";
import { FACTION_TYPES, QUEST_TYPES } from "./keywords.ts";

interface QuestAlias {
  kind: "ref" | "location";
  id: number;
  name: string;
  forcedRef?: string;
  uniqueActor?: string;
  forcedLocation?: string;
}

interface QuestDump {
  form: string;
  editorId: string;
  name: string;
  /** Plugins that contain this record, in load order; the last one wins. */
  definedIn: string[];
  /** Mission log category from QTYP (main/faction/side/activity/mission), or "" if untagged. */
  type: string;
  /** Faction from FTYP, or "". */
  faction: string;
  /** Raw DNAM (12 bytes in Starfield; layout not decoded yet). */
  dnam: string;
  stages: number[];
  /** Stages whose log entry has the "complete quest" flag (QSDT & 0x01). */
  completeStages: number[];
  /** Stages whose log entry has the "fail quest" flag (QSDT & 0x02). */
  failStages: number[];
  objectives: number;
  aliases: QuestAlias[];
  /** Count of each subrecord type, to learn Starfield's QUST layout. */
  subrecords: Record<string, number>;
  /** Quest-level subrecords that reference another form (QTYP = quest type, FTYP = faction, …). */
  refs: Record<string, string>;
  /** Creation Kit folder path (FLTR), e.g. "\Settlement\AkilaCity\". */
  filter: string;
}

// Quest-level subrecords that hold a single FormID (spike S2 is working out what each means).
const REFERENCE_FIELDS = new Set(["QTYP", "FTYP", "QMTY", "QSRC", "QTLM", "GNAM", "LNAM", "ENAM"]);

const { values: args } = parseArgs({
  options: {
    game: { type: "string" },
    out: { type: "string", default: "build/extract/quests.json" },
    lang: { type: "string", default: "en" },
  },
});

function readFormKey(data: Buffer, plugin: PluginHeader): string | undefined {
  return data.length >= 4 ? formKey(data.readUInt32LE(0), plugin) : undefined;
}

function parseQuest(record: PluginRecord, plugin: PluginHeader, strings: StringTable): QuestDump {
  const quest: QuestDump = {
    form: formKey(record.formId, plugin),
    editorId: "",
    name: "",
    definedIn: [plugin.name],
    type: "",
    faction: "",
    dnam: "",
    stages: [],
    completeStages: [],
    failStages: [],
    objectives: 0,
    aliases: [],
    subrecords: {},
    refs: {},
    filter: "",
  };

  let alias: QuestAlias | undefined;
  for (const { type, data } of record.subrecords) {
    quest.subrecords[type] = (quest.subrecords[type] ?? 0) + 1;
    if (REFERENCE_FIELDS.has(type) && !alias && !(type in quest.refs) && data.length === 4) {
      quest.refs[type] = formKey(data.readUInt32LE(0), plugin);
    }
    switch (type) {
      case "FLTR":
        quest.filter = zstring(data);
        break;
      case "EDID":
        quest.editorId = zstring(data);
        break;
      case "FULL":
        // Only the first FULL, before stages and aliases, is the quest's name.
        if (quest.subrecords[type] === 1 && !alias && quest.stages.length === 0) {
          quest.name = readLString(data, plugin, strings);
        }
        break;
      case "DNAM":
        quest.dnam ||= data.toString("hex");
        break;
      case "INDX":
        if (data.length >= 2) {
          quest.stages.push(data.readUInt16LE(0));
        }
        break;
      case "QSDT": {
        // Log entry flags for the stage set by the preceding INDX.
        const stage = quest.stages.at(-1);
        if (stage !== undefined && data.length >= 1) {
          if ((data[0] & 0x01) !== 0 && !quest.completeStages.includes(stage)) quest.completeStages.push(stage);
          if ((data[0] & 0x02) !== 0 && !quest.failStages.includes(stage)) quest.failStages.push(stage);
        }
        break;
      }
      case "QOBJ":
        quest.objectives++;
        break;
      case "ALST":
      case "ALLS":
        alias = { kind: type === "ALST" ? "ref" : "location", id: data.readUInt32LE(0), name: "" };
        quest.aliases.push(alias);
        break;
      case "ALID":
        if (alias) {
          alias.name = zstring(data);
        }
        break;
      case "ALFR":
        if (alias) {
          alias.forcedRef = readFormKey(data, plugin);
        }
        break;
      case "ALUA":
        if (alias) {
          alias.uniqueActor = readFormKey(data, plugin);
        }
        break;
      case "ALFL":
        if (alias) {
          alias.forcedLocation = readFormKey(data, plugin);
        }
        break;
      case "ALED":
        alias = undefined;
        break;
    }
  }
  quest.type = QUEST_TYPES[quest.refs.QTYP] ?? "";
  quest.faction = FACTION_TYPES[quest.refs.FTYP] ?? "";
  return quest;
}

const gamePath = resolveGamePath(args.game);
const dataDir = join(gamePath, "Data");
const plugins = officialPlugins(gamePath);
const quests = new Map<string, QuestDump>();

console.log(`Starfield: ${gamePath}`);
console.log(`Load order: ${plugins.map((p) => p.name).join(", ")}\n`);

for (const plugin of plugins) {
  const started = Date.now();
  const strings = plugin.localized ? loadPluginStrings(dataDir, plugin.name, args.lang) : new Map<number, string>();
  let count = 0;
  forEachRecord(plugin.path, ["QUST"], (record) => {
    count++;
    const quest = parseQuest(record, plugin, strings);
    const previous = quests.get(quest.form);
    if (previous) {
      quest.definedIn = [...previous.definedIn, plugin.name];
      quest.name ||= previous.name;
      quest.editorId ||= previous.editorId;
    }
    quests.set(quest.form, quest);
  });
  console.log(`${plugin.name}: ${count} QUST records, ${strings.size} strings (${Date.now() - started} ms)`);
}

const all = [...quests.values()];
console.log(`\n${all.length} quests, ${all.filter((q) => q.name).length} with a name\n`);

// Named quests with at least one objective, by mission log category and owning plugin.
const visible = all.filter((q) => q.name && q.objectives > 0);
const owners = [...new Set(visible.map((q) => q.form.split("|")[0]))];
const types = ["main", "faction", "side", "activity", "mission", ""];
console.log(`Named quests with objectives: ${visible.length}`);
console.log(`  ${"type".padEnd(12)}${owners.map((o) => o.replace(".esm", "").padStart(15)).join("")}`);
for (const type of types) {
  const counts = owners.map((owner) => visible.filter((q) => q.type === type && q.form.startsWith(`${owner}|`)).length);
  console.log(`  ${(type || "(untagged)").padEnd(12)}${counts.map((c) => String(c).padStart(15)).join("")}`);
}

const outFile = resolve(args.out);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      gamePath,
      plugins: plugins.map(({ name, masters, localized }) => ({ name, masters, localized })),
      quests: all,
    },
    null,
    2,
  ),
);
console.log(`\nWrote ${outFile}`);
