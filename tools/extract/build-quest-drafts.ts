// Builds draft quest collections (data/quests/*.json) from build/extract/quests.json:
// picks player-facing quests, finds where each one starts, and groups by system/planet/hub.
// Untagged quests that might be real go to docs/quest-review.md for curation.
//
//   npm run extract:quests && npm run build:drafts [-- --out <dir>]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { zstring } from "../esm/io.ts";
import { findRecords, forEachRecord, formKey, type PluginHeader } from "../esm/plugin.ts";
import { loadPluginStrings, readLString, type StringTable } from "../esm/strings.ts";
import { scanWorld, type CellInfo, type Placement } from "../esm/world.ts";
import { officialPlugins, resolveGamePath } from "./game.ts";
import { loadLocations, resolvePlace, type LocationInfo, type ResolvedPlace } from "./locations.ts";
import { findUnlocks } from "./unlocks.ts";

interface DumpAlias {
  kind: "ref" | "location";
  id: number;
  name: string;
  forcedRef?: string;
  uniqueActor?: string;
  forcedLocation?: string;
}

interface DumpQuest {
  form: string;
  editorId: string;
  name: string;
  type: string;
  faction: string;
  filter: string;
  objectives: number;
  objectiveIds: number[];
  objectiveText: string;
  objectiveList?: Array<{ id: number; text: string; targets: number[] }>;
  /** Set for small errands ("Misc Pointer" activities). */
  errand?: boolean;
  stages: number[];
  completeStages: number[];
  failStages: number[];
  aliases: DumpAlias[];
  /** What starts the quest without anyone handing it out (dump-quests.ts "start triggers"). */
  starts?: StartTrigger[];
}

type StartTrigger =
  | { kind: "event"; event: string; branch: string[]; locations: string[]; after: string[]; random: boolean }
  | { kind: "object"; record: string; form: string; editorId: string; name: string; script: string; stage: number; item?: string };

// Owning plugin → output file. Unknown plugins fall back to their own name.
const COLLECTIONS: Record<string, { file: string; id: string; title: string }> = {
  "Starfield.esm": { file: "vanilla.json", id: "vanilla.quests", title: "Starfield" },
  "ShatteredSpace.esm": { file: "shattered-space.json", id: "shattered-space.quests", title: "Shattered Space" },
  "SFBGS050.esm": { file: "terran-armada.json", id: "terran-armada.quests", title: "Terran Armada" },
  "SFBGS003.esm": { file: "trackers-alliance.json", id: "trackers-alliance.quests", title: "Trackers Alliance" },
  "SFBGS00D.esm": { file: "free-lanes.json", id: "free-lanes.quests", title: "Free Lanes update" },
};

const QUESTLINE_NAMES: Record<string, string> = {
  main: "Main Missions",
  constellation: "Constellation",
  "united-colonies": "UC Vanguard",
  "freestar-collective": "Freestar Rangers",
  "ryujin-industries": "Ryujin Industries",
  "crimson-fleet": "Crimson Fleet",
  "house-varuun": "House Va'ruun",
  "terran-armada": "Terran Armada",
  "trackers-alliance": "Trackers Alliance",
};

const { values: args } = parseArgs({
  options: {
    game: { type: "string" },
    lang: { type: "string", default: "en" },
    dump: { type: "string", default: "build/extract/quests.json" },
    out: { type: "string", default: "data/quests" },
  },
});

if (!existsSync(args.dump)) {
  console.error(`${args.dump} not found. Run "npm run extract:quests" first.`);
  process.exit(1);
}

// ---------------------------------------------------------------- pick quests

const dump = JSON.parse(readFileSync(args.dump, "utf8")) as { quests: DumpQuest[] };

// Which quest stages start each quest, from the game's stage fragments (script sources that
// `npm run build:mod` extracts to build/sf-scripts). Without them, no quest is marked
// "not available yet".
const scriptsDir = resolve("build/sf-scripts");
if (!existsSync(join(scriptsDir, "Fragments", "Quests"))) {
  console.warn("build/sf-scripts not found: run npm run build:mod once, then build:drafts again, to know when quests unlock");
}
const unlocks = findUnlocks(scriptsDir, dump.quests);
const dumpByEditorId = new Map(dump.quests.map((q) => [q.editorId.toLowerCase(), q]));
// At most this many quests can unlock one; more means it can start in too many ways to tell.
const MAX_UNLOCK_SOURCES = 4;
const playerFacing = (q: DumpQuest) => q.name && q.objectives > 0 && !q.name.includes("<Alias=") && !/^\[.*\]$/.test(q.name);
const NOT_A_QUEST = /(_OLD|Debug|Test|Template)\b|^(OE|SE|BE|RQ|MB|RAD|DialogueGeneric)_?/i;
// Untagged quests that are engine machinery or cut content rather than player quests
// (checked against the Map Genie checklist, see docs/research/S2-quest-types.md).
const INTERNAL_UNTAGGED = /Debug|Gauntlet|TempleQuest$|SpawnManager|Controller|^CUT_/i;

const tagged = dump.quests.filter((q) => playerFacing(q) && ["main", "faction", "side"].includes(q.type));
// Many real quests have no QTYP: Akila City and New Atlantis side quests, companion quests, encounters.
const untagged = dump.quests.filter(
  (q) => playerFacing(q) && q.type === "" && !NOT_A_QUEST.test(q.editorId) && !INTERNAL_UNTAGGED.test(q.editorId),
);
for (const quest of untagged) {
  quest.type = quest.editorId.startsWith("COM_") ? "companion" : "side";
}
// One-off activities (QTYP = activity), minus "Misc Pointer" nudges and engine handlers.
const NOT_AN_ACTIVITY = /pointer|handl|dialogue|tutorial|\bintro\b|^quest for|^misc quest|player house|^wrapper for|\[/i;
const activities = dump.quests.filter(
  (q) =>
    playerFacing(q) &&
    q.type === "activity" &&
    !NOT_AN_ACTIVITY.test(q.name) &&
    !/^(BE|OE|SQ)_|^LC\d+$|_Pointer$/.test(q.editorId) &&
    q.name !== q.editorId,
);

// Hand-curated fixes: exclusions, names, questline moves and order, either/or groups.
interface Curation {
  questlineOrder: Record<string, string[]>;
  moveToQuestline: Record<string, { questline: string; type: string; faction?: string }>;
  exclude: { editorIds: string[]; patterns: string[] };
  choiceGroups: Record<string, { a: { quests: string[]; lockedLabel: string }; b: { quests: string[]; lockedLabel: string } } | string>;
  ngPlusOnly: { editorIds: string[] };
  names: Record<string, string>;
  equivalents: Record<string, string[]>;
  leads: Record<string, string>;
  hints: Record<string, string>;
  unlocks?: Record<string, { after: string; stage: number } | string>;
}
const curation = JSON.parse(readFileSync(resolve("data/curation.json"), "utf8")) as Curation;
const excluded = (q: DumpQuest) =>
  curation.exclude.editorIds.includes(q.editorId) || curation.exclude.patterns.some((p) => new RegExp(p).test(q.editorId));
// Two-sided choices: editor ID -> the (group, side) pairs it belongs to.
const choicesOf = new Map<string, Array<{ group: string; side: "a" | "b" }>>();
for (const [group, sides] of Object.entries(curation.choiceGroups)) {
  if (typeof sides === "string") continue; // $comment
  for (const side of ["a", "b"] as const) {
    for (const id of sides[side].quests) choicesOf.set(id, [...(choicesOf.get(id) ?? []), { group, side }]);
  }
}
const ngPlusOnly = new Set(curation.ngPlusOnly.editorIds);
// Equivalent groups: the first member is shown, the rest are hidden.
const equivalentOf = new Map(Object.entries(curation.equivalents).filter(([group]) => !group.startsWith("$")).flatMap(([group, ids]) => ids.map((id, index) => [id, { group, hidden: index > 0 }] as const)));
const curatedOrder = new Map(Object.values(curation.questlineOrder).flatMap((ids) => ids.map((id, index) => [id, index + 1] as const)));

// Small errands ("Misc Pointer" activities). The game shows them by their first objective,
// e.g. "Talk to Sergeant Yumi", and counts them in its Activities Completed stat. Many have no
// name, or one like "Wrapper for NeonZ01", so their editor ID says what they are too. Templated
// ones ("Talk to <Alias…>") are repeatable job-board nudges and are skipped, as are encounter
// handlers (BE_, OE_, SQ_).
const isLead = (q: DumpQuest) => /pointer/i.test(q.name) || /^wrapper for/i.test(q.name) || /pointer|misc/i.test(q.editorId);
const errands = dump.quests.filter(
  (q) =>
    q.type === "activity" &&
    q.objectives > 0 &&
    isLead(q) &&
    !/^(BE|OE|SQ)_/.test(q.editorId) &&
    q.objectiveText !== "" &&
    !q.objectiveText.includes("<Alias") &&
    !activities.includes(q),
);
for (const quest of errands) {
  quest.name = quest.objectiveText.replace(/^\(Optional\)\s*/i, "");
  quest.errand = true;
}
// Many errands never flag a stage "complete quest": their last stage just shuts the quest down
// (e.g. FFLodge_MB stops at 100), so the game never reports them completed. Their last stage
// is the one that marks them done.
// Where an errand leads (data/curation.json "leads"): it counts as done once that quest has
// started, or for "Go to <place>" errands once the place is explored.
const leadOf = (quest: DumpQuest) => {
  const target = curation.leads[quest.editorId] ? dumpByEditorId.get(curation.leads[quest.editorId].toLowerCase()) : undefined;
  if (target) return { quest: target.editorId, form: target.form };
  if (curation.leads[quest.editorId]) throw new Error(`curation.json leads: ${curation.leads[quest.editorId]} not found`);
  const place = quest.errand && /^(go|travel) to /i.test(quest.name) ? quest.aliases.find((a) => a.kind === "location" && a.forcedLocation) : undefined;
  return place ? { location: place.forcedLocation as string, name: quest.name.replace(/^(go|travel) to /i, "") } : undefined;
};
const completeStagesOf = (quest: DumpQuest): number[] =>
  quest.completeStages.length || !quest.errand || quest.stages.length === 0 ? quest.completeStages : [Math.max(...quest.stages)];

const candidates = [...tagged, ...untagged, ...activities, ...errands].filter((q) => !excluded(q));
for (const quest of candidates) {
  quest.name = curation.names[quest.editorId] ?? quest.name;
  const move = curation.moveToQuestline[quest.editorId];
  if (move) {
    quest.type = move.type;
    quest.faction = move.faction ?? quest.faction;
  }
}
console.log(`${tagged.length} tagged quests + ${untagged.length} untagged quests + ${activities.length} activities + ${errands.length} errands (${tagged.length + untagged.length + activities.length + errands.length - candidates.length} excluded by curation)`);

// ---------------------------------------------------------------- game data

const gamePath = resolveGamePath(args.game);
const dataDir = join(gamePath, "Data");
const plugins = officialPlugins(gamePath);
const stringCache = new Map<string, StringTable>();
const stringsFor = (plugin: PluginHeader): StringTable => {
  if (!stringCache.has(plugin.name)) {
    stringCache.set(plugin.name, plugin.localized ? loadPluginStrings(dataDir, plugin.name, args.lang) : new Map());
  }
  return stringCache.get(plugin.name)!;
};

console.log("Reading locations…");
const locations = loadLocations(plugins, stringsFor);

// Every star system (LCTN key -> name), so the menu can name systems without tracked quests.
const systems = Object.fromEntries(
  [...locations.values()]
    .filter((l) => l.types.includes("LocTypeStarSystem") && l.name && !l.name.startsWith("_"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((l) => [l.key, l.name]),
);
writeFileSync(resolve(args.out, "../systems.json"), `${JSON.stringify(systems, null, 2)}\n`);
console.log(`systems.json: ${Object.keys(systems).length} star systems`);

const actorBases = new Set<string>();
const forcedRefs = new Set<string>();
for (const quest of candidates) {
  for (const alias of quest.aliases) {
    if (alias.uniqueActor) actorBases.add(alias.uniqueActor);
    if (alias.forcedRef) forcedRefs.add(alias.forcedRef);
  }
  // Triggers that start a quest when you walk into them, to say where they are.
  for (const start of quest.starts ?? []) if (start.kind === "object" && start.record === "REFR") forcedRefs.add(start.form);
}

console.log(`Scanning world for ${actorBases.size} quest actors and ${forcedRefs.size} forced references…`);
const cells = new Map<string, CellInfo>();
const worldspaces = new Map<string, CellInfo>();
const actorPlacements = new Map<string, Placement[]>();
const refPlacements = new Map<string, Placement>();
for (const plugin of plugins) {
  scanWorld(
    plugin,
    (type, raw) => type === "ACHR" || forcedRefs.has(formKey(raw, plugin)),
    (placement) => {
      if (forcedRefs.has(placement.ref)) refPlacements.set(placement.ref, placement);
      if (placement.type === "ACHR" && actorBases.has(placement.base)) {
        actorPlacements.set(placement.base, [...(actorPlacements.get(placement.base) ?? []), placement]);
      }
    },
    cells,
    worldspaces,
  );
}

const placementLocation = (placement: Placement | undefined): string | undefined => {
  if (!placement) return undefined;
  if (placement.location) return placement.location;
  const cell = placement.cell ? cells.get(placement.cell) : undefined;
  return cell?.location ?? (cell?.worldspace ? worldspaces.get(cell.worldspace)?.location : undefined);
};

// Names of quest-giver NPCs, for curation.
const actorNames = new Map<string, string>();
for (const plugin of plugins) {
  const owners = new Set([plugin.name, ...plugin.masters]);
  const wanted = new Set([...actorBases].filter((key) => owners.has(key.split("|")[0])));
  if (wanted.size === 0) continue;
  findRecords(plugin, wanted, (record, key) => {
    const full = record.subrecords.find((s) => s.type === "FULL");
    const name = full ? readLString(full.data, plugin, stringsFor(plugin)) : "";
    if (name) actorNames.set(key, name);
  });
}

// ---------------------------------------------------------------- objective text

// Objective text as the mission log would show it. <Alias=…> placeholders get the NPC or
// location name when the alias is fixed in the game data. Aliases filled at runtime (random
// planets, bounty targets) and counters (<Global=…>) become numbered tokens ("{0}") that the
// menu fills in game: Papyrus reports the alias's location / base object or the global's value,
// and the menu looks the name up in build/extract/names.json. Each token keeps a generic word
// ("the planet") for when that fails.
function aliasWord(alias: DumpAlias | undefined, name: string): string {
  if (/planet|moon/i.test(name)) return "the planet";
  if (/system/i.test(name)) return "the system";
  if (alias?.kind === "location" || /loc(ation)?/i.test(name)) return "the location";
  if (/ship/i.test(name)) return "the ship";
  return "the target";
}
const fixedName = (alias: DumpAlias | undefined) =>
  (alias?.uniqueActor && actorNames.get(alias.uniqueActor)) || (alias?.forcedLocation && locations.get(alias.forcedLocation)?.name) || undefined;

// Global variables by editor ID, for counters in objective text ("(<Global=X>/3)").
const globalForms = new Map<string, string>();
for (const plugin of plugins) {
  forEachRecord(plugin.path, ["GLOB"], (record) => {
    const editorId = record.subrecords.find((s) => s.type === "EDID");
    if (editorId) globalForms.set(zstring(editorId.data).toLowerCase(), formKey(record.formId, plugin));
  });
}

type Token = { kind: "location" | "ref"; alias: number; word: string } | { kind: "global"; form: string; word: string };
function objectiveText(quest: DumpQuest, raw: string): { text: string; tokens: Token[] } {
  const tokens: Token[] = [];
  const token = (t: Token) => `{${tokens.push(t) - 1}}`;
  const text = raw
    .replace(/<Global=([^>]*)>/g, (_, name: string) => {
      const form = globalForms.get(name.toLowerCase());
      return form ? token({ kind: "global", form, word: "#" }) : "#";
    })
    .replace(/<Alias(?:\.[A-Za-z]+)?=([^>]*)>/g, (_, name: string) => {
      const alias = quest.aliases.find((a) => a.name === name);
      const fixed = fixedName(alias);
      if (fixed) return fixed;
      const word = aliasWord(alias, name);
      return alias ? token({ kind: alias.kind === "location" ? "location" : "ref", alias: alias.id, word }) : word;
    })
    .replace(/\s+/g, " ")
    .trim();
  return { text, tokens };
}
function stepsOf(quest: DumpQuest) {
  return (quest.objectiveList ?? [])
    .filter((o) => o.text)
    .sort((a, b) => a.id - b.id)
    .map((o) => {
      const { text, tokens } = objectiveText(quest, o.text);
      return { id: o.id, text, ...(o.targets.length ? { target: o.targets[0] } : {}), ...(tokens.length ? { tokens } : {}) };
    });
}

// Names for runtime lookups (locations and actors), by "Plugin|0xFormID". Generated from the
// player's game files, so written to build/ (not committed); build:mod adds them to the menu.
{
  const names: Record<string, string> = {};
  for (const location of locations.values()) if (location.name) names[location.key] = location.name;
  for (const plugin of plugins) {
    forEachRecord(plugin.path, ["NPC_"], (record) => {
      const full = record.subrecords.find((s) => s.type === "FULL");
      const name = full ? readLString(full.data, plugin, stringsFor(plugin)) : "";
      if (name) names[formKey(record.formId, plugin)] = name;
    });
  }
  writeFileSync(resolve("build/extract/names.json"), JSON.stringify(names));
  console.log(`names.json: ${Object.keys(names).length} location and actor names`);
}

// ---------------------------------------------------------------- start places

// Hubs by normalized name, for matching folder paths and editor IDs.
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
const hubsByName = new Map<string, LocationInfo>();
for (const location of locations.values()) {
  const hub = resolvePlace(location.key, locations).hub;
  if (hub && hub.key === location.key && hub.name) {
    for (const variant of [hub.name, hub.name.replace(/ city$/i, "")]) {
      const key = normalize(variant);
      if (key.length >= 4 && !hubsByName.has(key)) hubsByName.set(key, hub);
    }
  }
}

function hintedHub(quest: DumpQuest): LocationInfo | undefined {
  const tokens = [
    ...quest.filter.split("\\"),
    ...quest.editorId.split("_").map((t) => t.replace(/^(FF|City)/, "").replace(/Z?\d+[A-Z]?$/, "")),
  ];
  for (const token of tokens) {
    const hub = hubsByName.get(normalize(token));
    if (hub) return hub;
  }
  return undefined;
}

interface Start {
  place: ResolvedPlace;
  giver?: string;
  /** The giver's NPC (unique actor), for pointing a marker at them. */
  giverForm?: string;
  /** Or the placed reference the quest starts at (a map marker, a terminal), for Show on map. */
  giverRef?: string;
  confidence: "high" | "medium" | "low";
  source: "giver" | "alias" | "filter" | "manual";
}

function findStart(quest: DumpQuest): Start {
  const hint = hintedHub(quest);

  for (const alias of quest.aliases) {
    if (alias.kind !== "ref") continue;
    const placement = alias.uniqueActor
      ? actorPlacements.get(alias.uniqueActor)?.[0]
      : alias.forcedRef
        ? refPlacements.get(alias.forcedRef)
        : undefined;
    const location = placementLocation(placement);
    if (!location) continue;
    const place = resolvePlace(location, locations);
    if (!place.system) continue;
    const agrees = hint !== undefined && place.hub?.key === hint.key;
    return {
      place,
      giver: alias.uniqueActor ? actorNames.get(alias.uniqueActor) : undefined,
      // Only a character: a placed reference here is often a map marker or an object.
      giverForm: alias.uniqueActor,
      giverRef: alias.uniqueActor ? undefined : alias.forcedRef,
      confidence: agrees ? "high" : "medium",
      source: "giver",
    };
  }

  for (const alias of quest.aliases) {
    if (alias.kind !== "location" || !alias.forcedLocation) continue;
    const place = resolvePlace(alias.forcedLocation, locations);
    if (place.system) {
      return { place, confidence: hint && place.hub?.key === hint.key ? "high" : "medium", source: "alias" };
    }
  }

  if (hint) {
    return { place: resolvePlace(hint.key, locations), confidence: "low", source: "filter" };
  }
  return { place: {}, confidence: "low", source: "manual" };
}

// ---------------------------------------------------------------- start hints

// How a quest with no giver starts, in one line, from its start triggers: a book to pick up,
// a vending machine, arriving somewhere, a random encounter. Hand-written ones in
// data/curation.json "hints" win. Nothing is said when the data doesn't tell.
const dumpByForm = new Map(dump.quests.map((q) => [q.form, q]));
const questName = (form: string) => {
  const quest = dumpByForm.get(form);
  return quest && playerFacing(quest) ? (curation.names[quest.editorId] ?? quest.name) : undefined;
};
const placeName = (key: string | undefined) => (key ? locations.get(key)?.name || resolvePlace(key, locations).hub?.name : undefined) || undefined;

/** "A", "A and B", "A, B and C", "A, B, C or 2 other places". */
function listOf(names: string[], last: "and" | "or"): string {
  if (names.length > 4) return `${names.slice(0, 3).join(", ")} ${last} ${names.length - 3} other places`;
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} ${last} ${names.at(-1)}`;
}

function objectHint(start: Extract<StartTrigger, { kind: "object" }>): string | undefined {
  const name = start.record === "BOOK" ? `"${start.name}"` : `the ${start.name}`;
  if (/VendingMachine/i.test(start.script) && start.item) {
    const price = /\((\d+) credits\)/i.exec(start.name)?.[1];
    return `Starts when you buy ${start.item} from a vending machine${price ? ` (${Number(price).toLocaleString("en-US")} credits)` : ""}`;
  }
  if (/TriggerEnter|EnterTrigger/i.test(start.script)) {
    const place = placeName(placementLocation(refPlacements.get(start.form)));
    return place ? `Starts when you reach a certain spot in ${place}` : undefined;
  }
  if (!start.name) return undefined;
  if (/containerchangedto/i.test(start.script)) return `Starts when you pick up ${name}`;
  if (/onread/i.test(start.script)) return `Starts when you read ${name}`;
  if (/onopen/i.test(start.script)) return `Starts when you open ${name}`;
  if (/onactivate|VendingMachine/i.test(start.script)) return `Starts when you interact with ${name}`;
  return undefined;
}

function eventHint(start: Extract<StartTrigger, { kind: "event" }>): string | undefined {
  const places = [...new Set(start.locations.map(placeName).filter((n): n is string => !!n))];
  const done = start.after.map(questName).filter((n): n is string => !!n);
  const after = done.length ? `, after ${listOf(done, "and")}` : "";
  const may = start.random ? "Can start" : "Starts";
  if (start.branch.some((n) => /eavesdrop/i.test(n)) && places.length) return `Overheard in ${listOf(places, "or")}${after}`;
  if (start.event === "CLOC" && places.length) return `${may} when you arrive in ${listOf(places, "or")}${after}`;
  // Encounters the game rolls for: in orbit (SE_), on a planet's surface (OE_), docking (BE).
  if (start.branch.some((n) => /^SE_|SpaceChangeLocation/.test(n))) return `Random encounter when you arrive in orbit${after}`;
  if (start.branch.some((n) => /^OE_/.test(n))) return `Random encounter on a planet's surface${after}`;
  if (start.branch.some((n) => /^BEDocking/.test(n))) return `Can happen when you dock with a ship${after}`;
  if (start.event === "CLOC" && done.length) return `Starts the next time you travel somewhere${after}`;
  return undefined;
}

function startHint(quest: DumpQuest): string | undefined {
  const starts = quest.starts ?? [];
  // Of the objects, only those that set the earliest stage: later ones may need the quest running.
  const objects = starts.flatMap((s) => (s.kind === "object" ? [s] : []));
  const first = objects.filter((s) => s.stage === Math.min(...objects.map((o) => o.stage)));
  const events = starts.flatMap((s) => (s.kind === "event" ? [s] : []));
  // The same event in several places (Story Manager nodes per city): one hint for all of them.
  const placed = events.filter((s) => s.locations.length);
  const arrive = placed.length ? [{ ...placed[0], locations: placed.flatMap((s) => s.locations), random: placed.some((s) => s.random) }] : [];
  // Something to find (a named object) says most, then a place to arrive in, then an encounter,
  // then a spot to walk into.
  const isTrigger = (s: (typeof objects)[number]) => /TriggerEnter|EnterTrigger/i.test(s.script);
  const hints = [
    ...first.filter((s) => !isTrigger(s)).map(objectHint),
    ...arrive.map(eventHint),
    ...events.filter((s) => !s.locations.length).map(eventHint),
    ...first.filter(isTrigger).map(objectHint),
  ];
  return hints.find((hint) => hint !== undefined);
}

// ---------------------------------------------------------------- write collections

/** Completion/failure stages as a schema condition: one stage, or anyOf several. */
function stageCondition(stages: number[]): object | undefined {
  if (stages.length === 0) return undefined;
  if (stages.length === 1) return { type: "questStage", stage: stages[0] };
  return { type: "anyOf", conditions: stages.map((stage) => ({ type: "questStage", stage })) };
}

const slug = (text: string) =>
  text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "x";

const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

interface PlaceEntry {
  id: string;
  kind: "system" | "planet" | "hub" | "anywhere";
  name: string;
  parent?: string;
  location?: string;
}

const outDir = resolve(args.out);
mkdirSync(outDir, { recursive: true });
const byOwner = new Map<string, DumpQuest[]>();
for (const quest of candidates) {
  const owner = quest.form.split("|")[0];
  byOwner.set(owner, [...(byOwner.get(owner) ?? []), quest]);
}

const stats = { high: 0, medium: 0, low: 0, unplaced: 0 };
const hintStats = { hinted: [] as string[], unhinted: [] as string[] };
const report: string[] = [];

for (const [owner, quests] of byOwner) {
  const collection = COLLECTIONS[owner] ?? { file: `${slug(owner.replace(/\.esm$/i, ""))}.json`, id: `${slug(owner.replace(/\.esm$/i, ""))}.quests`, title: owner };
  const places = new Map<string, PlaceEntry>(); // by location key
  const placeIds = new Set<string>();

  const addPlace = (location: LocationInfo, kind: PlaceEntry["kind"], parent?: PlaceEntry): PlaceEntry => {
    const existing = places.get(location.key);
    if (existing) return existing;
    const prefix = kind === "system" ? "sys" : kind === "planet" ? "pl" : "hub";
    let id = `${prefix}.${slug(location.name || location.editorId)}`;
    if (placeIds.has(id) && parent) id = `${id}.${parent.id.split(".")[1]}`;
    while (placeIds.has(id)) id = `${id}-2`;
    const entry: PlaceEntry = { id, kind, name: location.name || location.editorId, parent: parent?.id, location: location.key };
    places.set(location.key, entry);
    placeIds.add(id);
    return entry;
  };
  const anywhere: PlaceEntry = { id: "anywhere", kind: "anywhere", name: "Anywhere" };

  const questlines = new Map<string, { id: string; name: string; type: string; faction?: string }>();
  const entries = quests.sort((a, b) => naturalSort(a.editorId, b.editorId)).map((quest) => {
    const start = findStart(quest);
    // Quests a character hands out are found by Track start; the rest get a line on how they
    // start (a placed reference is only somewhere to go, and sometimes not even the start).
    const hint = curation.hints[quest.editorId] ?? (start.giverForm ? undefined : startHint(quest));
    if (!start.giverForm) hintStats[hint ? "hinted" : "unhinted"].push(quest.editorId);
    let place: PlaceEntry = anywhere;
    if (start.place.system) {
      const system = addPlace(start.place.system, "system");
      const planet = start.place.planet ? addPlace(start.place.planet, "planet", system) : undefined;
      place = start.place.hub ? addPlace(start.place.hub, "hub", planet ?? system) : (planet ?? system);
    } else {
      stats.unplaced++;
    }
    stats[start.confidence]++;
    if (start.confidence !== "high") {
      report.push(`| ${quest.editorId} | ${quest.name} | ${place.name} | ${start.confidence} | ${start.source} |`);
    }

    const lineId =
      curation.moveToQuestline[quest.editorId]?.questline ??
      (quest.type === "main" ? "main" : quest.type === "faction" && quest.faction ? quest.faction : undefined);
    if (lineId && !questlines.has(lineId)) {
      questlines.set(lineId, {
        id: lineId,
        name: QUESTLINE_NAMES[lineId] ?? lineId,
        type: quest.type === "main" ? "main" : "faction",
        ...(quest.faction ? { faction: quest.faction } : {}),
      });
    }
    const completeStages = completeStagesOf(quest);

    return {
      id: slug(quest.editorId),
      name: quest.name,
      form: quest.form,
      editorId: quest.editorId,
      type: quest.type,
      ...(quest.errand ? { errand: true } : {}),
      ...(quest.faction ? { faction: quest.faction } : {}),
      ...(lineId ? { questline: { id: lineId, order: 0 } } : {}),
      start: {
        place: place.id,
        ...(start.giver ? { giver: start.giver } : {}),
        ...(start.giverForm ? { giverForm: start.giverForm } : {}),
        ...(start.giverRef ? { giverRef: start.giverRef } : {}),
        ...(hint ? { hint } : {}),
        confidence: start.confidence,
        source: start.source,
      },
      stages: [...new Set(quest.stages)].sort((a, b) => a - b),
      objectives: [...quest.objectiveIds].sort((a, b) => a - b),
      steps: stepsOf(quest),
      complete: stageCondition(completeStages) ?? { type: "questCompleted" },
      // Flags are per log entry: a stage with a completing and a failing entry ends either way
      // depending on its conditions, which no script can read back. Count it as completed.
      fail: stageCondition(quest.failStages.filter((stage) => !completeStages.includes(stage))) ?? null,
      ...(choicesOf.has(quest.editorId) ? { choices: choicesOf.get(quest.editorId) } : {}),
      ...(ngPlusOnly.has(quest.editorId) ? { ngPlusOnly: true } : {}),
      equivalentGroup: equivalentOf.get(quest.editorId)?.group ?? null,
      ...(equivalentOf.get(quest.editorId)?.hidden ? { hidden: true } : {}),
      ...(leadOf(quest) ? { lead: leadOf(quest) } : {}),
    };
  });

  // Questline order comes from data/curation.json (story order); quests it doesn't list
  // go after, in editor-ID order.
  const counters = new Map<string, number>();
  for (const entry of entries) {
    if (entry.questline) {
      const listed = curation.questlineOrder[entry.questline.id]?.length ?? 0;
      const next = (counters.get(entry.questline.id) ?? listed) + 1;
      const curated = curatedOrder.get(entry.editorId);
      if (curated === undefined) counters.set(entry.questline.id, next);
      entry.questline.order = curated ?? next;
    }
  }

  // When each quest can be found: once one of the quest stages that start it is done, or else,
  // in a questline, once the previous quest has started (stage -1). The other branch of an
  // either/or choice is skipped, so the two endings don't wait on each other.
  // group: the source's equivalence group (e.g. One Small Step and its NG+ variants), so any
  // member completing counts.
  type After = { form: string; quest: string; name?: string; stage: number; group?: string };
  const groupOf = (editorId: string) => (equivalentOf.get(editorId) ? { group: equivalentOf.get(editorId)!.group } : {});
  const availability = new Map<string, After[]>();
  const sourceName = (editorId: string) => {
    const source = dumpByEditorId.get(editorId.toLowerCase());
    return source && playerFacing(source) ? source.name : undefined;
  };
  // NG+-only and hidden quests have their own rules (Unity, equivalent groups).
  const ownRules = (q: (typeof entries)[number]) => !!(q.ngPlusOnly || q.hidden);
  for (const entry of entries) {
    if (ownRules(entry)) continue;
    const firstStage = new Map<string, number>();
    for (const u of unlocks.get(entry.editorId.toLowerCase()) ?? []) if (!firstStage.has(u.editorId)) firstStage.set(u.editorId, u.stage);
    if (firstStage.size === 0 || firstStage.size > MAX_UNLOCK_SOURCES) continue;
    const after = [...firstStage].flatMap(([editorId, stage]) => {
      const source = dumpByEditorId.get(editorId.toLowerCase());
      return source ? [{ form: source.form, quest: editorId, ...(sourceName(editorId) ? { name: sourceName(editorId) } : {}), stage, ...groupOf(editorId) }] : [];
    });
    if (after.length) availability.set(entry.editorId, after);
  }
  // Hand-written ones (data/curation.json "unlocks") win: quests another quest's script starts
  // in a way the scan above doesn't see (a manager quest starting the next of a chain).
  for (const [editorId, rule] of Object.entries(curation.unlocks ?? {})) {
    if (typeof rule === "string") continue; // $comment
    const source = dumpByEditorId.get(rule.after.toLowerCase());
    if (!source) throw new Error(`curation.unlocks: ${editorId} waits on unknown quest ${rule.after}`);
    // Waiting on itself: no name, so the menu says how it starts (its hint), not "After <itself> starts".
    const named = rule.after !== editorId && sourceName(rule.after);
    availability.set(editorId, [{ form: source.form, quest: rule.after, ...(named ? { name: named } : {}), stage: rule.stage, ...groupOf(rule.after) }]);
  }
  const lines = new Map<string, typeof entries>();
  for (const entry of entries) if (entry.questline) lines.set(entry.questline.id, [...(lines.get(entry.questline.id) ?? []), entry]);
  for (const line of lines.values()) {
    line.sort((a, b) => a.questline!.order - b.questline!.order);
    line.forEach((entry, i) => {
      if (availability.has(entry.editorId) || ownRules(entry)) return;
      // Skip only quests on the other side of one of this quest's choices.
      const otherSide = (q: (typeof line)[number]) => (q.choices ?? []).some((c) => (entry.choices ?? []).some((mine) => mine.group === c.group && mine.side !== c.side));
      let prev = i - 1;
      while (prev >= 0 && (otherSide(line[prev]) || ownRules(line[prev]))) prev--;
      if (prev < 0) return;
      const before = line[prev];
      availability.set(entry.editorId, [{ form: before.form, quest: before.editorId, name: before.name, stage: -1, ...groupOf(before.editorId) }]);
    });
  }
  for (const entry of entries) {
    const after = availability.get(entry.editorId);
    if (after) Object.assign(entry, { availableAfter: after });
  }

  const usedPlaces = [...places.values()];
  if (entries.some((e) => e.start.place === anywhere.id)) usedPlaces.push(anywhere);
  const requires = owner === "Starfield.esm" ? ["Starfield.esm"] : ["Starfield.esm", owner];

  const file = join(outDir, collection.file);
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        $schema: "../schema/quests.schema.json",
        schema: 1,
        id: collection.id,
        title: collection.title,
        requires,
        places: usedPlaces.sort((a, b) => a.id.localeCompare(b.id)),
        questlines: [...questlines.values()],
        quests: entries,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${collection.file}: ${entries.length} quests, ${usedPlaces.length} places`);
}

// ---------------------------------------------------------------- review list

const review = [
  "# Quest drafts: review list",
  "",
  `Generated by \`npm run build:drafts\`. Start places: ${stats.high} high, ${stats.medium} medium, ${stats.low} low confidence (${stats.unplaced} with no place found).`,
  "",
  "## Start places to check (medium/low confidence)",
  "",
  "| Editor ID | Quest | Start place | Confidence | Source |",
  "|---|---|---|---|---|",
  ...report,
  "",
  "## Untagged quests (no QTYP), included as side/companion quests",
  "",
  "Included automatically; remove any that turn out not to be real quests (add their editor ID pattern to INTERNAL_UNTAGGED).",
  "",
  "| Editor ID | Quest | Form | Folder |",
  "|---|---|---|---|",
  ...untagged.map((q) => `| ${q.editorId} | ${q.name} | ${q.form} | ${q.filter} |`),
  "",
];
writeFileSync(resolve("docs/quest-review.md"), review.join("\n"));
console.log(`\nStart places: ${stats.high} high, ${stats.medium} medium, ${stats.low} low (${stats.unplaced} unplaced)`);
console.log(`Start hints: ${hintStats.hinted.length} of ${hintStats.hinted.length + hintStats.unhinted.length} quests with no giver to track (none for ${hintStats.unhinted.join(", ")})`);
console.log("Review list: docs/quest-review.md");
