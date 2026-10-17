// Dumps every QUST record from the official masters to build/extract/quests.json
// and prints a summary grouped by quest type (spike S2).
//
//   node tools/extract/dump-quests.ts [--game <Starfield folder>] [--out <file>] [--lang en]

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { zstring } from "../esm/io.ts";
import { findRecords, forEachRecord, formKey, type PluginHeader, type PluginRecord } from "../esm/plugin.ts";
import { loadPluginStrings, readLString, type StringTable } from "../esm/strings.ts";
import { isScriptObject, readScripts } from "../esm/vmad.ts";
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
  /** Objective indices (QOBJ), for checking which objectives the game displays. */
  objectiveIds: number[];
  /** Display text of the first objective (NNAM), e.g. "Talk to Cmdr. Tuala". */
  objectiveText: string;
  /** Every objective: index, display text (may hold <Alias=…> placeholders) and target alias ids (QSTA). */
  objectiveList: Array<{ id: number; text: string; targets: number[] }>;
  aliases: QuestAlias[];
  /** Count of each subrecord type, to learn Starfield's QUST layout. */
  subrecords: Record<string, number>;
  /** Quest-level subrecords that reference another form (QTYP = quest type, FTYP = faction, …). */
  refs: Record<string, string>;
  /** Creation Kit folder path (FLTR), e.g. "\Settlement\AkilaCity\". */
  filter: string;
  /** What starts the quest without anyone handing it out (see "start triggers" below). */
  starts: StartTrigger[];
}

/**
 * Something in the game data that starts a quest:
 * - "event": a Story Manager event (QUST/SMQN/SMBN/SMEN), e.g. arriving somewhere (CLOC) or a
 *   script event (SCPT), with the location it must happen in and the quests that must be done.
 * - "object": a script on a book, activator or placed reference that sets one of the quest's
 *   first stages: picking up or reading a book, using an activator, walking into a trigger.
 */
type StartTrigger =
  | {
      kind: "event";
      /** Story Manager event type (ENAM), e.g. "CLOC" (change location), "SCPT" (script event). */
      event: string;
      /** Editor IDs of the nodes from the quest's node up to the event node. */
      branch: string[];
      /** Locations (LCTN) the event has to happen in, any of them. */
      locations: string[];
      /** Quests that must be completed first (QUST). */
      after: string[];
      /** A random roll decides (GetRandomPercent): it can start, not always. */
      random: boolean;
    }
  | {
      kind: "object";
      /** Record type holding the script: BOOK, ACTI, REFR, … */
      record: string;
      form: string;
      editorId: string;
      /** The record's name, or for a placed reference its base object's. */
      name: string;
      /** The script, e.g. defaultrefoncontainerchangedto (picked up), defaultrefonread, DefaultRefOnTriggerEnter. */
      script: string;
      stage: number;
      /** What the script hands over, by name (a vending machine's kibble). */
      item?: string;
    };

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
    objectiveIds: [],
    objectiveText: "",
    objectiveList: [],
    aliases: [],
    subrecords: {},
    refs: {},
    filter: "",
    starts: [],
  };

  let alias: QuestAlias | undefined;
  let objective: QuestDump["objectiveList"][number] | undefined;
  // Conditions between NEXT and the first stage are the quest's Story Manager conditions.
  let storyConditions = false;
  const conditions: Condition[] = [];
  for (const { type, data } of record.subrecords) {
    quest.subrecords[type] = (quest.subrecords[type] ?? 0) + 1;
    if (type === "NEXT") storyConditions = true;
    if (type === "INDX" || type === "ALST" || type === "ALLS") storyConditions = false;
    if (type === "CTDA" && storyConditions) conditions.push(readCondition(data, plugin));
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
        if (data.length >= 2 && !quest.objectiveIds.includes(data.readUInt16LE(0))) {
          quest.objectiveIds.push(data.readUInt16LE(0));
          objective = { id: data.readUInt16LE(0), text: "", targets: [] };
          quest.objectiveList.push(objective);
        }
        break;
      case "QSTA":
        if (objective && !alias && data.length >= 4 && data.readInt32LE(0) >= 0) objective.targets.push(data.readInt32LE(0));
        break;
      case "NNAM":
        if (!alias) {
          const text = readLString(data, plugin, strings);
          quest.objectiveText ||= text;
          if (objective && !objective.text) objective.text = text;
        }
        break;
      case "ALST":
      case "ALLS":
        objective = undefined;
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
  questConditions.set(quest.form, conditions);
  return quest;
}

// ---------------------------------------------------------------- start triggers

// Condition functions (CTDA) used to read Story Manager conditions; indices from xEdit's
// Starfield definitions.
const GET_RANDOM_PERCENT = 77;
const GET_IS_CURRENT_LOCATION = 359;
const GET_QUEST_COMPLETED = 543;
const GET_EVENT_DATA = 576;

interface Condition {
  fn: number;
  /** Comparison: 0 ==, 1 !=, 2 >, 3 >=, 4 <, 5 <=. */
  op: number;
  /** Compared against a global variable rather than a number. */
  global: boolean;
  value: number;
  params: [string, string];
  /** The raw first parameter (GetEventData packs the event member into it). */
  raw1: number;
}

function readCondition(data: Buffer, plugin: PluginHeader): Condition {
  return {
    fn: data.readUInt16LE(8),
    op: data[0] >> 5,
    global: (data[0] & 0x04) !== 0,
    value: data.readFloatLE(4),
    params: [formKey(data.readUInt32LE(12), plugin), formKey(data.readUInt32LE(16), plugin)],
    raw1: data.readUInt32LE(12),
  };
}

const isTrue = (c: Condition) => c.op === 0 && !c.global && c.value === 1;

/** Story Manager conditions of each quest (QUST), by form. */
const questConditions = new Map<string, Condition[]>();

interface StoryNode {
  type: string;
  editorId: string;
  parent?: string;
  event?: string;
  conditions: Condition[];
  quests: string[];
}

function parseStoryNode(record: PluginRecord, plugin: PluginHeader): StoryNode {
  const node: StoryNode = { type: record.type, editorId: "", conditions: [], quests: [] };
  for (const { type, data } of record.subrecords) {
    if (type === "EDID") node.editorId = zstring(data);
    if (type === "PNAM" && data.length >= 4 && data.readUInt32LE(0) !== 0) node.parent = formKey(data.readUInt32LE(0), plugin);
    if (type === "ENAM" && data.length >= 4) node.event = data.toString("latin1", 0, 4);
    if (type === "CTDA") node.conditions.push(readCondition(data, plugin));
    if (type === "NNAM" && data.length >= 4) node.quests.push(formKey(data.readUInt32LE(0), plugin));
  }
  return node;
}

// Object scripts that set a quest stage when the player does something with the object.
// QuestToSetOrCheck/StageToSet are the game's default scripts (DefaultRefOnActivate,
// defaultrefonread, …); the Terran Armada vending machines name theirs VariantQuest.
const QUEST_PROPERTIES = ["QuestToSetOrCheck", "QuestToStart", "VariantQuest"];
const OBJECT_TYPES = ["ACTI", "BOOK", "MISC", "CONT", "DOOR", "FURN", "FLOR", "REFR"];

interface ObjectScript {
  quest: string;
  /** Stage it sets; undefined for DefaultStartQuestOnTriggerEnter, which starts the quest. */
  stage?: number;
  prereq: boolean;
  record: string;
  form: string;
  editorId: string;
  name: string;
  base?: string;
  item?: string;
  script: string;
}

const gamePath = resolveGamePath(args.game);
const dataDir = join(gamePath, "Data");
const plugins = officialPlugins(gamePath);
const quests = new Map<string, QuestDump>();
const storyNodes = new Map<string, StoryNode>();
const objectScripts: ObjectScript[] = [];

console.log(`Starfield: ${gamePath}`);
console.log(`Load order: ${plugins.map((p) => p.name).join(", ")}\n`);

for (const plugin of plugins) {
  const started = Date.now();
  const strings = plugin.localized ? loadPluginStrings(dataDir, plugin.name, args.lang) : new Map<number, string>();
  forEachRecord(plugin.path, ["SMQN", "SMBN", "SMEN"], (record) => {
    storyNodes.set(formKey(record.formId, plugin), parseStoryNode(record, plugin));
  });
  // Placed references live in CELL and WRLD groups. Every one is read, which takes a few seconds.
  forEachRecord(
    plugin.path,
    OBJECT_TYPES,
    (record) => {
      const vmad = record.subrecords.find((s) => s.type === "VMAD");
      if (!vmad) return;
      for (const script of readScripts(vmad.data)) {
        const questProperty = QUEST_PROPERTIES.map((p) => script.properties.get(p)).find(isScriptObject);
        if (!questProperty) continue;
        const stage = script.properties.get("StageToSet");
        const prereq = script.properties.get("PrereqStage");
        if (typeof stage !== "number" && script.name !== "DefaultStartQuestOnTriggerEnter") continue;
        const sub = (type: string) => record.subrecords.find((s) => s.type === type)?.data;
        const item = script.properties.get("KibbleToVend");
        objectScripts.push({
          quest: formKey(questProperty.form, plugin),
          stage: typeof stage === "number" ? stage : undefined,
          prereq: typeof prereq === "number" && prereq >= 0,
          record: record.type,
          form: formKey(record.formId, plugin),
          editorId: sub("EDID") ? zstring(sub("EDID")!) : "",
          name: sub("FULL") ? readLString(sub("FULL")!, plugin, strings) : "",
          base: sub("NAME") ? formKey(sub("NAME")!.readUInt32LE(0), plugin) : undefined,
          item: isScriptObject(item) ? formKey(item.form, plugin) : undefined,
          script: script.name,
        });
      }
    },
    [...OBJECT_TYPES, "CELL", "WRLD"],
  );
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

// What starts each quest. Story Manager: walk from every quest node up to its event node,
// skipping debug branches. Object scripts: those that set one of the quest's first stages
// (setting a stage starts a quest that isn't running) and don't need an earlier stage done.
interface StoryStart {
  quest: QuestDump;
  event: string;
  branch: string[];
  conditions: Condition[];
}
const storyStarts: StoryStart[] = [];
for (const [questForm, quest] of quests) {
  for (const node of storyNodes.values()) {
    if (!node.quests.includes(questForm)) continue;
    const chain: StoryNode[] = [];
    for (let at: StoryNode | undefined = node; at && !chain.includes(at); at = at.parent ? storyNodes.get(at.parent) : undefined) chain.push(at);
    const root = chain.at(-1)!;
    if (root.type !== "SMEN" || !root.event || chain.some((n) => /debug/i.test(n.editorId))) continue;
    const conditions = [...chain.flatMap((n) => n.conditions), ...(questConditions.get(questForm) ?? [])];
    storyStarts.push({ quest, event: root.event, branch: chain.map((n) => n.editorId), conditions });
  }
}
// Where it must happen: GetEventData on the event's location ("L" member) or GetIsCurrentLocation.
const eventLocations = (conditions: Condition[]) =>
  conditions
    .filter((c) => isTrue(c) && ((c.fn === GET_EVENT_DATA && ((c.raw1 >>> 16) & 0xff) === 0x4c) || c.fn === GET_IS_CURRENT_LOCATION))
    .map((c) => (c.fn === GET_EVENT_DATA ? c.params[1] : c.params[0]));
const questsDone = (start: StoryStart) =>
  start.conditions.filter((c) => isTrue(c) && c.fn === GET_QUEST_COMPLETED && c.params[0] !== start.quest.form).map((c) => c.params[0]);

const firstStages = (quest: QuestDump) => [...new Set(quest.stages)].sort((a, b) => a - b).slice(0, 3);
const objectStarts = [...new Map(objectScripts.map((s) => [`${s.form} ${s.quest} ${s.script}`, s])).values()].filter((script) => {
  const quest = quests.get(script.quest);
  return quest && !script.prereq && (script.stage === undefined || firstStages(quest).includes(script.stage));
});

// Name and type the forms these point at: base objects, items, locations and quests.
const lookups = new Set([
  ...storyStarts.flatMap((s) => [...eventLocations(s.conditions), ...questsDone(s)]),
  ...objectStarts.flatMap((s) => [s.base, s.item].filter((key): key is string => !!key)),
]);
const forms = new Map<string, { type: string; name: string }>();
for (const plugin of plugins) {
  const owners = new Set([plugin.name, ...plugin.masters]);
  const wanted = new Set([...lookups].filter((key) => owners.has(key.split("|")[0])));
  if (wanted.size === 0) continue;
  const strings = plugin.localized ? loadPluginStrings(dataDir, plugin.name, args.lang) : new Map<number, string>();
  findRecords(plugin, wanted, (record, key) => {
    const full = record.subrecords.find((s) => s.type === "FULL");
    forms.set(key, { type: record.type, name: (full ? readLString(full.data, plugin, strings) : "") || forms.get(key)?.name || "" });
  });
}
const ofType = (type: string) => (key: string) => forms.get(key)?.type === type;

for (const start of storyStarts) {
  start.quest.starts.push({
    kind: "event",
    event: start.event,
    branch: start.branch,
    locations: [...new Set(eventLocations(start.conditions).filter(ofType("LCTN")))],
    after: [...new Set(questsDone(start).filter(ofType("QUST")))],
    random: start.conditions.some((c) => c.fn === GET_RANDOM_PERCENT),
  });
}
for (const script of objectStarts) {
  const item = script.item ? forms.get(script.item)?.name : undefined;
  quests.get(script.quest)!.starts.push({
    kind: "object",
    record: script.record,
    form: script.form,
    editorId: script.editorId,
    name: script.name || (script.base ? forms.get(script.base)?.name : undefined) || "",
    script: script.script,
    stage: script.stage ?? 0,
    ...(item ? { item } : {}),
  });
}
const named = all.filter((q) => q.name && q.objectives > 0);
console.log(
  `Start triggers: ${named.filter((q) => q.starts.some((s) => s.kind === "event")).length} named quests with a Story Manager event, ` +
    `${named.filter((q) => q.starts.some((s) => s.kind === "object")).length} with an object script\n`,
);

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
