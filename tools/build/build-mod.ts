// Builds the mod's game-side files from data/quests/*.json:
//   build/mod/StarfieldCompletionist.esm             one start-game-enabled quest running our script
//   build/papyrus/Completionist/QuestData.psc        generated quest table (compiled with papyrus/Source)
//   build/mod/Scripts/Completionist/*.pex            compiled scripts (needs the Starfield Creation Kit)
//   build/mod/SFSE/Plugins/OSF/...                   the OSF UI menu view and OSF Settings hotkey schema
//
//   npm run build:mod [-- --install] [-- --game <Starfield folder>]
//
// --install copies the .esm and scripts into <game>/Data and activates the plugin in Plugins.txt.

import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolveGamePath } from "../extract/game.ts";
import { group, pluginFile, record, subrecord, uint32Data, vmadData, zstringData } from "../esm/writer.ts";

// Windows bsdtar (System32): Git for Windows puts GNU tar first on PATH, which can't write zips
// and treats "C:" as a remote host.
const windowsTar = () => join(process.env.SystemRoot ?? "C:/Windows", "System32/tar.exe");

const repo = fileURLToPath(new URL("../../", import.meta.url));
const { values: args } = parseArgs({
  options: { game: { type: "string" }, install: { type: "boolean", default: false } },
});
const PLUGIN_NAME = "StarfieldCompletionist.esm";
const MAX_COMPLETE_STAGES = 4;
const MAX_FAIL_STAGES = 2;
// Every activity has at most 8 objectives; quests with more are "in progress" while running.
const MAX_OBJECTIVES = 8;
// Papyrus arrays hold at most 128 elements, so the table is split into pages;
// QuestTracker.psc has one variable per page (keep MAX_PAGES in sync with it).
const PAGE_SIZE = 100;
const MAX_PAGES = 4;

interface Condition {
  type: string;
  stage?: number;
  conditions?: Condition[];
}

interface Collection {
  places?: Array<{ id: string; name: string; parent?: string; location?: string }>;
  quests: Array<{ id: string; name: string; form: string; type: string; editorId: string; start: { place: string }; complete: Condition; fail?: Condition | null; objectives?: number[]; choices?: Array<{ group: string; side: string }>; ngPlusOnly?: boolean; equivalentGroup?: string | null; hidden?: boolean }>;
}

/** Stages from a questStage / anyOf-of-questStage condition. */
function stagesOf(condition: Condition | null | undefined): number[] {
  if (!condition) return [];
  if (condition.type === "questStage" && condition.stage !== undefined) return [condition.stage];
  if (condition.type === "anyOf") return (condition.conditions ?? []).flatMap(stagesOf);
  return [];
}

const papyrusString = (text: string) => `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

// ---------------------------------------------------------------- quest table

const calls: string[] = [];
const dataDir = join(repo, "data/quests");
for (const file of readdirSync(dataDir).filter((f) => f.endsWith(".json")).sort()) {
  const collection = JSON.parse(readFileSync(join(dataDir, file), "utf8")) as Collection;
  const places = new Map((collection.places ?? []).map((p) => [p.id, p]));
  // The nearest place with an LCTN record, as (local FormID, plugin) for Game.GetFormFromFile; (0, "") if none.
  const startLocation = (id: string): [number, string] => {
    for (let place = places.get(id); place; place = place.parent ? places.get(place.parent) : undefined) {
      if (place.location) {
        const [plugin, hex] = place.location.split("|");
        return [Number.parseInt(hex, 16), papyrusString(plugin)];
      }
    }
    return [0, papyrusString("")];
  };
  const describe = (id: string) => {
    const names: string[] = [];
    for (let place = places.get(id); place && names.length < 8; place = place.parent ? places.get(place.parent) : undefined) {
      names.push(place.name);
    }
    return names.join(" < ");
  };

  for (const quest of collection.quests) {
    const [plugin, hex] = quest.form.split("|");
    const complete = stagesOf(quest.complete);
    const fail = stagesOf(quest.fail);
    if (complete.length > MAX_COMPLETE_STAGES || fail.length > MAX_FAIL_STAGES) {
      throw new Error(`${quest.editorId}: too many completion/failure stages for the Papyrus table`);
    }
    const pad = (stages: number[], size: number) => [...stages, ...Array(size - stages.length).fill(-1)];
    const args = [
      Number.parseInt(hex, 16),
      papyrusString(plugin),
      papyrusString(quest.id),
      papyrusString(quest.name),
      papyrusString(describe(quest.start.place)),
      papyrusString(places.get(quest.start.place)?.name ?? "Anywhere"),
      quest.type === "activity" ? "True" : "False",
      ...[0, 1].flatMap((i) => [papyrusString(quest.choices?.[i]?.group ?? ""), papyrusString(quest.choices?.[i]?.side ?? "")]),
      quest.ngPlusOnly ? "True" : "False",
      // Objectives for "in progress": up to MAX_OBJECTIVES indices, or "many" for big story quests.
      ...Array.from({ length: MAX_OBJECTIVES }, (_, i) => ((quest.objectives ?? []).length <= MAX_OBJECTIVES ? (quest.objectives?.[i] ?? -1) : -1)),
      (quest.objectives ?? []).length > MAX_OBJECTIVES ? "True" : "False",
      papyrusString(quest.equivalentGroup ?? ""),
      quest.hidden ? "True" : "False",
      ...startLocation(quest.start.place),
      ...pad(complete, MAX_COMPLETE_STAGES),
      ...pad(fail, MAX_FAIL_STAGES),
    ];
    calls.push(`Add(entries, ${args.join(", ")}) ; ${file}`);
  }
}

const count = calls.length;
const pages: string[][] = [];
for (let i = 0; i < calls.length; i += PAGE_SIZE) pages.push(calls.slice(i, i + PAGE_SIZE));
if (pages.length > MAX_PAGES) {
  throw new Error(`${count} quests need ${pages.length} pages; raise MAX_PAGES here and in QuestTracker.psc`);
}
const pageBlocks = pages
  .map((page, index) => [`  ${index === 0 ? "If" : "ElseIf"} aiPage == ${index}`, ...page.map((call) => `    ${call}`)].join("\n"))
  .join("\n");

const questData = `; GENERATED by tools/build/build-mod.ts from data/quests/*.json. Do not edit.
ScriptName Completionist:QuestData Const Hidden

Struct Entry
  Quest questForm
  String id ; quest id from data/quests, shared with the menu
  String name
  String place
  String hub ; first part of place, e.g. "Neon"
  Bool activity ; one-off activity rather than a quest
  ; Never remove fields: Papyrus saves running functions mid-execution, and code resumed
  ; from an older save fails if a field it uses is gone.
  String exclusive ; unused since 1.0 (replaced by the choice fields below)
  ; Two-sided choice groups (up to two): completing a quest on one side locks out the
  ; unfinished quests on the other side. "" = none.
  String choice1Group
  String choice1Side
  String choice2Group
  String choice2Side
  Bool ngPlusOnly ; only available after entering Unity; not counted before that
  ; Objective indices (-1 = unused). In progress = running with one of these displayed and open,
  ; matching the game's mission log. objectivesMany: too many to list, so running is enough.
  Int obj1 = -1
  Int obj2 = -1
  Int obj3 = -1
  Int obj4 = -1
  Int obj5 = -1
  Int obj6 = -1
  Int obj7 = -1
  Int obj8 = -1
  Bool objectivesMany
  String equivalent ; versions of the same quest: completing any member completes the group ("" = none)
  Bool hidden ; tracked only through its equivalent group; not listed or counted
  Location startLocation ; where the quest starts, for plotting a course (None if unknown)
  Int complete1 = -1
  Int complete2 = -1
  Int complete3 = -1
  Int complete4 = -1
  Int fail1 = -1
  Int fail2 = -1
  Int status = 0 ; set by QuestTracker
  Int raw = 0 ; status from the quest itself, before overrides, equivalents and choices (QuestTracker)
EndStruct

; Papyrus arrays hold at most 128 elements, so quests come in pages of up to ${PAGE_SIZE}.
Int Function PageCount() Global
  Return ${pages.length}
EndFunction

; Returns the tracked quests on page aiPage whose plugin is loaded (${count} quests in the data).
Entry[] Function LoadPage(Int aiPage) Global
  Entry[] entries = new Entry[0]
${pageBlocks}
  EndIf
  Return entries
EndFunction

Function Add(Entry[] akEntries, Int aiFormID, String asPlugin, String asId, String asName, String asPlace, String asHub, Bool abActivity, String asChoice1Group, String asChoice1Side, String asChoice2Group, String asChoice2Side, Bool abNgPlusOnly, Int aiObj1, Int aiObj2, Int aiObj3, Int aiObj4, Int aiObj5, Int aiObj6, Int aiObj7, Int aiObj8, Bool abObjectivesMany, String asEquivalent, Bool abHidden, Int aiLocationID, String asLocationPlugin, Int aiComplete1, Int aiComplete2, Int aiComplete3, Int aiComplete4, Int aiFail1, Int aiFail2) Global
  Quest found = Game.GetFormFromFile(aiFormID, asPlugin) as Quest
  If found
    Entry entry = new Entry
    entry.questForm = found
    entry.id = asId
    entry.name = asName
    entry.place = asPlace
    entry.hub = asHub
    entry.activity = abActivity
    entry.choice1Group = asChoice1Group
    entry.choice1Side = asChoice1Side
    entry.choice2Group = asChoice2Group
    entry.choice2Side = asChoice2Side
    entry.ngPlusOnly = abNgPlusOnly
    entry.obj1 = aiObj1
    entry.obj2 = aiObj2
    entry.obj3 = aiObj3
    entry.obj4 = aiObj4
    entry.obj5 = aiObj5
    entry.obj6 = aiObj6
    entry.obj7 = aiObj7
    entry.obj8 = aiObj8
    entry.objectivesMany = abObjectivesMany
    entry.equivalent = asEquivalent
    entry.hidden = abHidden
    If aiLocationID > 0
      entry.startLocation = Game.GetFormFromFile(aiLocationID, asLocationPlugin) as Location
    EndIf
    entry.complete1 = aiComplete1
    entry.complete2 = aiComplete2
    entry.complete3 = aiComplete3
    entry.complete4 = aiComplete4
    entry.fail1 = aiFail1
    entry.fail2 = aiFail2
    akEntries.Add(entry)
  EndIf
EndFunction
`;

const papyrusDir = join(repo, "build/papyrus/Completionist");
mkdirSync(papyrusDir, { recursive: true });
writeFileSync(join(papyrusDir, "QuestData.psc"), questData);

// ---------------------------------------------------------------- plugin

// Our own records start at 0x800; the top byte is our index after the masters (1).
const OWN = 0x01000000;
const trackerQuest = record("QUST", OWN | 0x800, [
  subrecord("EDID", zstringData("Completionist_QuestTracker")),
  subrecord("VMAD", vmadData(["Completionist:QuestTracker", "Completionist:MenuBridge"])),
  subrecord("DNAM", Buffer.from("110100000000000000000000", "hex")), // start game enabled, like SQ_ShipVendors
  subrecord("NEXT"),
  subrecord("ANAM", uint32Data(0)),
]);

const esm = pluginFile(
  { author: "rixbrnn", masters: ["Starfield.esm"], flags: 0x1, nextObjectId: 0x801 },
  [group("QUST", [trackerQuest])],
  2, // records + groups
);

const modDir = join(repo, "build/mod");
mkdirSync(modDir, { recursive: true });
writeFileSync(join(modDir, PLUGIN_NAME), esm);

console.log(`QuestData.psc: ${count} quests`);
console.log(`${PLUGIN_NAME}: ${esm.length} bytes`);

// ---------------------------------------------------------------- menu (OSF UI view)

// Static data for the menu: quests, places and questlines. Papyrus only sends statuses.
// Places are keyed by their LCTN FormID key so the same city merges across collections.
interface MenuPlace {
  name: string;
  kind: string;
  parent?: string;
  loc?: string;
}
const menuPlaces: Record<string, MenuPlace> = {};
const menuQuests: object[] = [];
const menuLines = new Map<string, { id: string; name: string; group: string; quests: Array<{ id: string; order: number; file: number }> }>();
const collectionFiles = readdirSync(dataDir).filter((f) => f.endsWith(".json")).sort((a, b) => (a === "vanilla.json" ? -1 : b === "vanilla.json" ? 1 : a.localeCompare(b)));
collectionFiles.forEach((file, fileIndex) => {
  const collection = JSON.parse(readFileSync(join(dataDir, file), "utf8")) as {
    title?: string;
    places?: Array<{ id: string; name: string; kind: string; parent?: string; location?: string }>;
    questlines?: Array<{ id: string; name: string }>;
    quests: Array<{ id: string; name: string; type: string; errand?: boolean; faction?: string; questline?: { id: string; order: number }; start: { place: string; giver?: string }; choices?: Array<{ group: string; side: string }>; ngPlusOnly?: boolean; hidden?: boolean; steps?: Array<{ id: number; text: string; target?: number }> }>;
  };
  const keyOf = new Map((collection.places ?? []).map((p) => [p.id, p.location ?? `${file}:${p.id}`]));
  for (const place of collection.places ?? []) {
    const key = keyOf.get(place.id)!;
    menuPlaces[key] ??= { name: place.name, kind: place.kind, parent: place.parent ? keyOf.get(place.parent) : undefined, loc: place.location };
  }
  for (const line of collection.questlines ?? []) {
    if (!menuLines.has(line.id)) menuLines.set(line.id, { id: line.id, name: line.name, group: collection.title ?? "", quests: [] });
  }
  for (const quest of collection.quests) {
    if (quest.hidden) continue; // tracked through its visible equivalent
    menuQuests.push({
      id: quest.id,
      name: quest.name,
      type: quest.type,
      faction: quest.faction,
      activity: quest.type === "activity",
      errand: quest.errand || undefined,
      giver: quest.start.giver,
      place: keyOf.get(quest.start.place) ?? null,
      choices: quest.choices,
      ngPlusOnly: quest.ngPlusOnly || undefined,
      // Objectives as [index, text, target alias or -1], for the expanded quest row.
      steps: quest.steps?.length ? quest.steps.map((s) => [s.id, s.text, s.target ?? -1]) : undefined,
    });
    if (quest.questline) {
      menuLines.get(quest.questline.id)?.quests.push({ id: quest.id, order: quest.questline.order, file: fileIndex });
    }
  }
});
// Labels for locked-out quests, per choice group and side.
const curation = JSON.parse(readFileSync(join(repo, "data/curation.json"), "utf8")) as { choiceGroups: Record<string, unknown> };
const choiceLabels = Object.fromEntries(
  Object.entries(curation.choiceGroups)
    .filter(([, sides]) => typeof sides === "object")
    .map(([group, sides]) => {
      const s = sides as Record<"a" | "b", { lockedLabel: string }>;
      return [group, { a: s.a.lockedLabel, b: s.b.lockedLabel }];
    }),
);
// All star systems (LCTN key -> name), to name systems that have no tracked quests.
const systems = JSON.parse(readFileSync(join(repo, "data/systems.json"), "utf8")) as Record<string, string>;
const menuData = {
  choiceLabels,
  systems,
  places: menuPlaces,
  quests: menuQuests,
  questlines: [...menuLines.values()].map((line) => ({
    id: line.id,
    name: line.name,
    group: line.group,
    quests: line.quests.sort((a, b) => a.order - b.order || a.file - b.file).map((q) => q.id),
  })),
};

// Layout under Data/: SFSE/Plugins/OSF/UI/views/<mod>/<view>/ and SFSE/Plugins/OSF/Settings/schemas/<mod>.json
const viewDir = join(modDir, "SFSE/Plugins/OSF/UI/views/completionist/menu");
rmSync(viewDir, { recursive: true, force: true });
cpSync(join(repo, "ui/menu"), viewDir, { recursive: true });
writeFileSync(
  join(viewDir, "data.js"),
  `// GENERATED by tools/build/build-mod.ts from data/quests/*.json. Do not edit.\nwindow.COMPLETIONIST_DATA = ${JSON.stringify(menuData)};\n`,
);
const schemaDir = join(modDir, "SFSE/Plugins/OSF/Settings/schemas");
mkdirSync(schemaDir, { recursive: true });
copyFileSync(join(repo, "settings/completionist.json"), join(schemaDir, "completionist.json"));
console.log(`Menu view: ${menuQuests.length} quests, ${Object.keys(menuPlaces).length} places, ${menuLines.size} questlines`);

// ---------------------------------------------------------------- compile

const gamePath = resolveGamePath(args.game);
const compiler = join(gamePath, "Tools/Papyrus Compiler/PapyrusCompiler.exe");
if (!existsSync(compiler)) {
  console.log("Papyrus compiler not found: install the Starfield Creation Kit from Steam to compile scripts.");
  process.exit(args.install ? 1 : 0);
}

// Base game script sources ship zipped with the Creation Kit; extract them once (never commit them).
const baseScripts = join(repo, "build/sf-scripts");
if (!existsSync(join(baseScripts, "Quest.psc"))) {
  console.log("Extracting base script sources from ContentResources.zip…");
  const staging = join(repo, "build/sf-scripts-staging");
  mkdirSync(staging, { recursive: true });
  const tar = spawnSync(windowsTar(), ["-xf", join(gamePath, "Tools/ContentResources.zip"), "-C", staging, "Scripts/Source"], { stdio: "inherit" });
  if (tar.status !== 0) {
    throw new Error("Could not extract ContentResources.zip");
  }
  renameSync(join(staging, "Scripts/Source"), baseScripts);
  rmSync(staging, { recursive: true, force: true });
}

const scriptsOut = join(modDir, "Scripts");
const imports = [join(repo, "papyrus/Source"), join(repo, "papyrus/vendor"), join(repo, "build/papyrus"), baseScripts].join(";");
for (const script of ["Completionist:QuestData", "Completionist:QuestTracker", "Completionist:MenuBridge"]) {
  const result = spawnSync(
    compiler,
    [script, `-f=${join(baseScripts, "Starfield_Papyrus_Flags.flg")}`, `-i=${imports}`, `-o=${scriptsOut}`],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    throw new Error(`Compiling ${script} failed`);
  }
  console.log(`Compiled ${script}`);
}

// ---------------------------------------------------------------- install

if (args.install) {
  const data = join(gamePath, "Data");
  copyFileSync(join(modDir, PLUGIN_NAME), join(data, PLUGIN_NAME));
  mkdirSync(join(data, "Scripts/Completionist"), { recursive: true });
  for (const file of readdirSync(join(scriptsOut, "Completionist"))) {
    copyFileSync(join(scriptsOut, "Completionist", file), join(data, "Scripts/Completionist", file));
  }

  // Starfield reads active plugins from %LOCALAPPDATA%/Starfield/Plugins.txt ("*" = active).
  const pluginsTxt = join(process.env.LOCALAPPDATA ?? "", "Starfield/Plugins.txt");
  const lines = existsSync(pluginsTxt)
    ? readFileSync(pluginsTxt, "utf8").split(/\r?\n/).filter((line) => line.trim() !== "")
    : ["# This file is used by Starfield to keep track of your downloaded content."];
  if (!lines.some((line) => line.replace(/^\*/, "").toLowerCase() === PLUGIN_NAME.toLowerCase())) {
    lines.push(`*${PLUGIN_NAME}`);
    writeFileSync(pluginsTxt, `${lines.join("\r\n")}\r\n`);
  }
  // The OSF UI view and OSF Settings schema (used only when those mods are installed).
  cpSync(join(modDir, "SFSE"), join(data, "SFSE"), { recursive: true });
  console.log(`Installed into ${data} and activated in ${pluginsTxt}`);
}
