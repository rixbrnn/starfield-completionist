// Builds draft quest collections (data/quests/*.json) from build/extract/quests.json:
// picks player-facing quests, finds where each one starts, and groups by system/planet/hub.
// Untagged quests that might be real go to docs/quest-review.md for curation.
//
//   npm run extract:quests && npm run build:drafts [-- --out <dir>]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { findRecords, formKey, type PluginHeader } from "../esm/plugin.ts";
import { loadPluginStrings, readLString, type StringTable } from "../esm/strings.ts";
import { scanWorld, type CellInfo, type Placement } from "../esm/world.ts";
import { officialPlugins, resolveGamePath } from "./game.ts";
import { loadLocations, resolvePlace, type LocationInfo, type ResolvedPlace } from "./locations.ts";

interface DumpAlias {
  kind: "ref" | "location";
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
  stages: number[];
  completeStages: number[];
  failStages: number[];
  aliases: DumpAlias[];
}

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
const candidates = [...tagged, ...untagged];
console.log(`${tagged.length} tagged quests + ${untagged.length} untagged quests`);

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

const actorBases = new Set<string>();
const forcedRefs = new Set<string>();
for (const quest of candidates) {
  for (const alias of quest.aliases) {
    if (alias.uniqueActor) actorBases.add(alias.uniqueActor);
    if (alias.forcedRef) forcedRefs.add(alias.forcedRef);
  }
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

    const lineId = quest.type === "main" ? "main" : quest.type === "faction" && quest.faction ? quest.faction : undefined;
    if (lineId && !questlines.has(lineId)) {
      questlines.set(lineId, {
        id: lineId,
        name: QUESTLINE_NAMES[lineId] ?? lineId,
        type: quest.type === "main" ? "main" : "faction",
        ...(quest.faction ? { faction: quest.faction } : {}),
      });
    }

    return {
      id: slug(quest.editorId),
      name: quest.name,
      form: quest.form,
      editorId: quest.editorId,
      type: quest.type,
      ...(quest.faction ? { faction: quest.faction } : {}),
      ...(lineId ? { questline: { id: lineId, order: 0 } } : {}),
      start: {
        place: place.id,
        ...(start.giver ? { giver: start.giver } : {}),
        confidence: start.confidence,
        source: start.source,
      },
      stages: [...new Set(quest.stages)].sort((a, b) => a - b),
      complete: stageCondition(quest.completeStages) ?? { type: "questCompleted" },
      fail: stageCondition(quest.failStages) ?? null,
    };
  });

  // Order within each questline follows editor IDs (RI01, RI02, …); curation fixes exceptions.
  const counters = new Map<string, number>();
  for (const entry of entries) {
    if (entry.questline) {
      const next = (counters.get(entry.questline.id) ?? 0) + 1;
      counters.set(entry.questline.id, next);
      entry.questline.order = next;
    }
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
console.log("Review list: docs/quest-review.md");
