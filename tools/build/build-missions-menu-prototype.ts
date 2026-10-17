// PROTOTYPE (wayfinder ticket #5, "How progress looks in a replaced Missions menu"). Throwaway:
// lives on the prototype/missions-menu branch, never merged. See ui/missions-menu-prototype/README.md.
//
// Builds the Creations-edition stand-in for testing on PC with SFSE off:
//   1. reads the vanilla missionmenu.swf + _lrg from the player's Starfield - Interface.ba2
//   2. FFDec decompiles both, this script inserts the thin hook into MissionMenu.as, FFDec recompiles
//   3. Flex mxmlc compiles our own SWF (ui/missions-menu-prototype/as3) with the quest database built in
//   4. writes CompletionistProto.esm: one quest whose objectives show text-display globals, the feed
//   5. compiles the feed's Papyrus, packs everything into "CompletionistProto - Main.ba2" with Archive2
//   6. zips the .esm + .ba2 for Vortex (never writes into the game's Data folder)
//
//   node tools/build/build-missions-menu-prototype.ts [--toolchain <dir>] [--game <Starfield folder>]
//
// The toolchain folder holds jdk17/, ffdec/ and flex/ (see the README for where each comes from).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { openBa2, readBa2Entry } from "../esm/ba2.ts";
import { group, pluginFile, record, subrecord, uint32Data, vmadData, zstringData } from "../esm/writer.ts";
import { resolveGamePath } from "../extract/game.ts";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const { values: args } = parseArgs({ options: { toolchain: { type: "string" }, game: { type: "string" } } });
const toolchain = args.toolchain ?? process.env.COMPLETIONIST_TOOLCHAIN ?? join(repo, "build/toolchain");
const gamePath = resolveGamePath(args.game);
const out = join(repo, "build/missions-proto");
const protoSrc = join(repo, "ui/missions-menu-prototype");

const jdk = readdirSync(join(toolchain, "jdk17")).find((d) => d.startsWith("jdk"));
if (!jdk) throw new Error(`No JDK in ${toolchain}/jdk17`);
const java = join(toolchain, "jdk17", jdk, "bin/java.exe");
const ffdec = join(toolchain, "ffdec/ffdec-cli.jar");
const mxmlc = join(toolchain, "flex/lib/mxmlc.jar");
const playerglobal = join(toolchain, "ffdec/flashlib/playerglobal32_0.swc");
for (const tool of [java, ffdec, mxmlc, playerglobal]) if (!existsSync(tool)) throw new Error(`Missing ${tool}`);

function run(command: string, commandArgs: string[], what: string) {
  const started = Date.now();
  const result = spawnSync(command, commandArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    throw new Error(`${what} failed`);
  }
  console.log(`${what}: ${Date.now() - started} ms`);
  return result.stdout;
}

rmSync(out, { recursive: true, force: true });
const stage = join(out, "stage");
mkdirSync(join(stage, "Interface/Completionist"), { recursive: true });

// ---------------------------------------------------------------- 1. vanilla SWFs

const MENUS = ["missionmenu.swf", "missionmenu_lrg.swf"];
const interfaceBa2 = openBa2(join(gamePath, "Data/Starfield - Interface.ba2"));
if (!interfaceBa2) throw new Error("Can't open Starfield - Interface.ba2");
mkdirSync(join(out, "vanilla"), { recursive: true });
const vanillaHashes: Record<string, string> = {};
for (const name of MENUS) {
  const entry = interfaceBa2.entries.find((e) => e.name === `interface/${name}`);
  if (!entry) throw new Error(`interface/${name} not in the archive`);
  const data = readBa2Entry(interfaceBa2, entry);
  writeFileSync(join(out, "vanilla", name), data);
  vanillaHashes[name] = createHash("sha256").update(data).digest("hex");
}
console.log("Vanilla SHA-256:", vanillaHashes);

// ---------------------------------------------------------------- 2. the hook

// Each edit: an anchor in the decompiled vanilla MissionMenu.as and what goes in at it. A missing
// anchor stops the build: the game's menu changed and the hook needs porting.
const HOOK_IMPORTS = [
  "flash.display.Loader",
  "flash.display.LoaderInfo",
  "flash.events.IOErrorEvent",
  "flash.net.URLRequest",
  "flash.system.ApplicationDomain",
  "flash.system.LoaderContext",
];
const HOOK_MEMBERS = `
      // COMPLETIONIST PROTOTYPE HOOK: everything else lives in Interface/Completionist/CompletionistMissions.swf.
      public var Cmpl:Object = null;

      private function CmplLoad() : void
      {
         var loader:Loader = new Loader();
         loader.contentLoaderInfo.addEventListener(Event.COMPLETE,this.CmplLoaded);
         loader.contentLoaderInfo.addEventListener(IOErrorEvent.IO_ERROR,this.CmplFailed);
         loader.load(new URLRequest("Completionist/CompletionistMissions.swf"),new LoaderContext(false,ApplicationDomain.currentDomain));
         addChild(loader);
      }

      private function CmplLoaded(param1:Event) : void
      {
         this.Cmpl = (param1.target as LoaderInfo).content;
         this.Cmpl.Attach(this,this.CmplRaw);
      }

      private function CmplFailed(param1:IOErrorEvent) : void
      {
      }

      private var CmplRaw:Array = null;

      // Our feed quest is shown by our SWF, never in the vanilla list.
      private function CmplQuestData(param1:Array) : Array
      {
         var _loc2_:Array = new Array();
         var _loc3_:uint = 0;
         this.CmplRaw = param1;
         while(_loc3_ < param1.length)
         {
            if(!(param1[_loc3_].aObjectives != null && param1[_loc3_].aObjectives.length > 0 && String(param1[_loc3_].aObjectives[0].sName).indexOf("CMPL|") == 0))
            {
               _loc2_.push(param1[_loc3_]);
            }
            _loc3_++;
         }
         if(this.Cmpl != null)
         {
            this.Cmpl.OnQuestData(param1);
         }
         return _loc2_;
      }
`;
const HOOK_EDITS: Array<{ anchor: string; replace: (anchor: string) => string }> = [
  // Members, before the constructor.
  { anchor: "      public function MissionMenu()\n", replace: (a) => HOOK_MEMBERS + "\n" + a },
  // Load our SWF once the constructor has set the menu up.
  {
    anchor: '         _loc1_.EntryClassName = "MissionsListEntry";\n         this.MissionsList_mc.Configure(_loc1_);\n',
    replace: (a) => a + "         this.CmplLoad();\n",
  },
  // Our category tab, after Completed. Flag 0: the vanilla list shows nothing under it.
  {
    anchor: "         this.TabbedFilterSelection_mc.SetTabsData(this.FilterInfoA);\n",
    replace: (a) => '         this.FilterInfoA.push({\n            "text":"COMPLETIONIST",\n            "flag":0\n         });\n' + a,
  },
  // Quest data: ours goes to our SWF, the rest to the vanilla list.
  { anchor: "         this.QuestData = param1.data.aQuests;\n", replace: () => "         this.QuestData = this.CmplQuestData(param1.data.aQuests);\n" },
  // Tab changes show or hide our view.
  {
    anchor: "         this.MissionsList_mc.filterMask = this.currentFilterFlag;\n",
    replace: (a) => a + "         if(this.Cmpl != null)\n         {\n            this.Cmpl.OnTab();\n         }\n",
  },
  // Input goes to our view first while it's showing.
  {
    anchor: "      public function ProcessUserEvent(param1:String, param2:Boolean) : Boolean\n      {\n         var _loc3_:Boolean = false;\n",
    replace: (a) => a + "         if(this.Cmpl != null && this.Cmpl.ProcessUserEvent(param1,param2))\n         {\n            return true;\n         }\n",
  },
];

function patchMissionMenu(source: string): string {
  let patched = source;
  for (const { anchor, replace } of HOOK_EDITS) {
    const at = patched.indexOf(anchor);
    if (at < 0 || patched.indexOf(anchor, at + 1) >= 0) throw new Error(`Hook anchor not found exactly once:\n${anchor}`);
    patched = patched.slice(0, at) + replace(anchor) + patched.slice(at + anchor.length);
  }
  const lastImport = patched.lastIndexOf("   import ");
  const lineEnd = patched.indexOf("\n", lastImport) + 1;
  const imports = HOOK_IMPORTS.filter((i) => !patched.includes(`import ${i};`)).map((i) => `   import ${i};\n`).join("");
  return patched.slice(0, lineEnd) + imports + patched.slice(lineEnd);
}

for (const name of MENUS) {
  const base = name.replace(".swf", "");
  const decompiled = join(out, "decompiled", base);
  run(java, ["-jar", ffdec, "-selectclass", "MissionMenu", "-export", "script", decompiled, join(out, "vanilla", name)], `FFDec decompile ${name}`);
  const source = readFileSync(join(decompiled, "scripts/MissionMenu.as"), "utf8").replaceAll("\r\n", "\n");
  const hookDir = join(out, "hook", base);
  mkdirSync(hookDir, { recursive: true });
  writeFileSync(join(hookDir, "MissionMenu.as"), patchMissionMenu(source));
  run(java, ["-jar", ffdec, "-importScript", join(out, "vanilla", name), join(stage, "Interface", name), hookDir], `FFDec hook ${name}`);
}

// ---------------------------------------------------------------- quest database (shared by 3 and 4)

interface Place { id: string; name: string; kind: string; parent?: string; location?: string }
interface Quest { id: string; name: string; form: string; type: string; errand?: boolean; ngPlusOnly?: boolean; hidden?: boolean; start: { place: string } }
const dataDir = join(repo, "data/quests");
// Same file order as build-mod.ts's quest table.
const files = readdirSync(dataDir).filter((f) => f.endsWith(".json")).sort();
const placeKeys: string[] = [];
const placeIndex = new Map<string, number>();
const placeRows: Array<{ name: string; kind: string; parent?: string; loc?: string }> = [];
const quests: Array<{ quest: Quest; place: string | null }> = [];
for (const file of files) {
  const collection = JSON.parse(readFileSync(join(dataDir, file), "utf8")) as { places?: Place[]; quests: Quest[] };
  const keyOf = new Map((collection.places ?? []).map((p) => [p.id, p.location ?? `${file}:${p.id}`]));
  for (const place of collection.places ?? []) {
    const key = keyOf.get(place.id)!;
    if (placeIndex.has(key)) continue;
    placeIndex.set(key, placeKeys.length);
    placeKeys.push(key);
    placeRows.push({ name: place.name, kind: place.kind, parent: place.parent ? keyOf.get(place.parent) : undefined, loc: place.location });
  }
  for (const quest of collection.quests) quests.push({ quest, place: keyOf.get(quest.start.place) ?? null });
}
const plugins = ["Starfield.esm", ...[...new Set(quests.map((q) => q.quest.form.split("|")[0]))].filter((p) => p !== "Starfield.esm").sort()];
const pluginOf = (form: string) => plugins.indexOf(form.split("|")[0]);
const localOf = (form: string) => Number.parseInt(form.split("|")[1], 16);
// One form per DLC plugin, whose runtime FormID Papyrus reports, giving the plugin's load-order prefix.
const references = plugins.slice(1).map((plugin) => quests.find((q) => q.quest.form.startsWith(plugin + "|"))!.quest.form);
const STATUS_PER_GLOBAL = 8; // 3 bits each: 8^8 = 2^24, exact in a Papyrus float
const statusGlobals = Math.ceil(quests.length / STATUS_PER_GLOBAL);
const LOCATION_SLOTS = 6;

// ---------------------------------------------------------------- 3. our SWF

const as3 = (value: unknown) => JSON.stringify(value);
const database = `// GENERATED by tools/build/build-missions-menu-prototype.ts from data/quests/*.json. PROTOTYPE.
package completionist
{
   public class QuestDatabase
   {
      public static const PLUGINS:Array = ${as3(plugins)};
      // Per DLC plugin (PLUGINS[i + 1]): the local FormID whose runtime FormID the feed reports.
      public static const REFERENCES:Array = ${as3(references.map(localOf))};
      public static const STATUS_PER_GLOBAL:int = ${STATUS_PER_GLOBAL};
      public static const LOCATION_SLOTS:int = ${LOCATION_SLOTS};
      // [name, kind, parent index or -1, plugin index or -1, local FormID]
      public static const PLACES:Array = [
${placeRows.map((p) => `         ${as3([p.name, p.kind, p.parent ? placeIndex.get(p.parent) ?? -1 : -1, p.loc ? pluginOf(p.loc) : -1, p.loc ? localOf(p.loc) : 0])}`).join(",\n")}
      ];
      // [id, name, plugin index, local FormID, type, place index or -1, flags: 1 activity, 2 errand, 4 NG+ only, 8 hidden]
      public static const QUESTS:Array = [
${quests.map(({ quest, place }) => `         ${as3([quest.id, quest.name, pluginOf(quest.form), localOf(quest.form), quest.type, place ? placeIndex.get(place) ?? -1 : -1, (quest.type === "activity" ? 1 : 0) | (quest.errand ? 2 : 0) | (quest.ngPlusOnly ? 4 : 0) | (quest.hidden ? 8 : 0)])}`).join(",\n")}
      ];
   }
}
`;
const genAs3 = join(out, "gen/as3/completionist");
mkdirSync(genAs3, { recursive: true });
writeFileSync(join(genAs3, "QuestDatabase.as"), database);
run(
  java,
  [
    "-Duser.language=en", "-Xmx1g", "-jar", mxmlc, `+flexlib=${join(toolchain, "flex/frameworks")}`, "-load-config=",
    `-external-library-path=${playerglobal}`, "-target-player=11.1", "-swf-version=12", "-default-size=1920,1080",
    "-default-frame-rate=30", "-default-background-color=0x000000", "-optimize=true", "-debug=false",
    `-source-path=${join(protoSrc, "as3")}`, `-source-path+=${join(out, "gen/as3")}`,
    `-output=${join(stage, "Interface/Completionist/CompletionistMissions.swf")}`,
    join(protoSrc, "as3/completionist/CompletionistMissions.as"),
  ],
  "mxmlc CompletionistMissions.swf",
);
// The browser smoke test (Ruffle): the same source in a fake menu, served by harness/serve.ts.
const harnessDir = join(out, "harness");
mkdirSync(harnessDir, { recursive: true });
run(
  java,
  [
    "-Duser.language=en", "-Xmx1g", "-jar", mxmlc, `+flexlib=${join(toolchain, "flex/frameworks")}`, "-load-config=",
    `-external-library-path=${playerglobal}`, "-target-player=11.1", "-swf-version=12", "-default-size=1920,1080",
    "-default-frame-rate=30", "-default-background-color=0x000000",
    `-source-path=${join(protoSrc, "as3")}`, `-source-path+=${join(out, "gen/as3")}`, `-source-path+=${join(protoSrc, "harness")}`,
    `-output=${join(harnessDir, "harness.swf")}`, join(protoSrc, "harness/Harness.as"),
  ],
  "mxmlc harness.swf",
);
copyFileSync(join(protoSrc, "harness/index.html"), join(harnessDir, "index.html"));

// ---------------------------------------------------------------- 4. the feed plugin

const PLUGIN = "CompletionistProto.esm";
const OWN = 0x01000000;
const QUEST_ID = OWN | 0x800;
const globals: string[] = [
  "CMPLP_Counter", "CMPLP_Flags",
  ...Array.from({ length: LOCATION_SLOTS * 2 }, (_, i) => `CMPLP_L${String(i).padStart(2, "0")}`),
  ...Array.from({ length: references.length * 2 }, (_, i) => `CMPLP_P${String(i).padStart(2, "0")}`),
  ...Array.from({ length: statusGlobals }, (_, i) => `CMPLP_S${String(i).padStart(2, "0")}`),
];
const globalId = (edid: string) => OWN | (0x801 + globals.indexOf(edid));
const tags = (prefix: string) => globals.filter((g) => g.startsWith(prefix)).map((g) => `<Global=${g}>`);
// Objective text: "CMPL|<section>|<first index>|v;v;v". Sections: H header, L location chain, P plugin prefixes, S statuses.
const objectives = [
  `CMPL|H|0|${tags("CMPLP_Counter").concat(tags("CMPLP_Flags")).join(";")}`,
  `CMPL|L|0|${tags("CMPLP_L").join(";")}`,
  `CMPL|P|0|${tags("CMPLP_P").join(";")}`,
];
const statusTags = tags("CMPLP_S");
for (let i = 0; i < statusTags.length; i += STATUS_PER_GLOBAL) {
  objectives.push(`CMPL|S|${i}|${statusTags.slice(i, i + STATUS_PER_GLOBAL).join(";")}`);
}

const u16 = (v: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
const dnam = Buffer.alloc(12);
dnam.writeUInt32LE(0x111, 0); // start game enabled, starts enabled, run once (like the tracker)
const stageIndex = Buffer.from([10, 0, 0x40, 0]); // stage 10, "Ready To Display On UI"
const feedQuest = record("QUST", QUEST_ID, [
  subrecord("EDID", zstringData("CompletionistProto_Feed")),
  subrecord("VMAD", vmadData(["CompletionistProto:Feed"])),
  subrecord("FULL", zstringData("Completionist (prototype feed)")),
  subrecord("DNAM", dnam),
  subrecord("QTYP", uint32Data(0x047600)), // QuestTypeSideQuest: its own list entry, not merged into Misc
  ...globals.map((g) => subrecord("QTGL", uint32Data(globalId(g)))),
  subrecord("NEXT"),
  subrecord("INDX", stageIndex),
  subrecord("QSDT", Buffer.from([0])),
  subrecord("CNAM", zstringData("Completionist prototype: this quest carries the tracker's data to the Missions menu.")),
  subrecord("QSRD", uint32Data(0)),
  subrecord("QSRD"),
  ...objectives.flatMap((text, i) => [subrecord("QOBJ", u16(i)), subrecord("FNAM", uint32Data(0)), subrecord("NNAM", zstringData(text))]),
  subrecord("ANAM", uint32Data(0)),
]);
const globalRecords = globals.map((g) => record("GLOB", globalId(g), [subrecord("EDID", zstringData(g)), subrecord("FLTV", Buffer.alloc(4))]));
const esm = pluginFile(
  { author: "rixbrnn (prototype)", masters: ["Starfield.esm"], flags: 0x1, nextObjectId: 0x801 + globals.length },
  [group("GLOB", globalRecords), group("QUST", [feedQuest])],
  1 + globals.length + 2,
);
const packageDir = join(out, "package");
mkdirSync(packageDir, { recursive: true });
writeFileSync(join(packageDir, PLUGIN), esm);
console.log(`${PLUGIN}: ${globals.length} globals, ${objectives.length} objectives, longest objective ${Math.max(...objectives.map((o) => o.length))} chars`);

// ---------------------------------------------------------------- 5. Papyrus + archive

const papyrusString = (text: string) => `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
const pages: string[][] = [];
for (let i = 0; i < quests.length; i += 128) pages.push(quests.slice(i, i + 128).map((q) => q.quest.id));
const ids = `; GENERATED by tools/build/build-missions-menu-prototype.ts. PROTOTYPE.
ScriptName CompletionistProto:Ids Const Hidden

Int Function Count() Global
  Return ${quests.length}
EndFunction

Int Function PageCount() Global
  Return ${pages.length}
EndFunction

Int Function StatusGlobals() Global
  Return ${statusGlobals}
EndFunction

Int Function LocationSlots() Global
  Return ${LOCATION_SLOTS}
EndFunction

Int Function ObjectiveCount() Global
  Return ${objectives.length}
EndFunction

Int Function GlobalCount() Global
  Return ${globals.length}
EndFunction

; Index of the first global of each section, in form order from 0x801.
Int Function FirstLocationGlobal() Global
  Return 2
EndFunction

Int Function FirstPrefixGlobal() Global
  Return ${2 + LOCATION_SLOTS * 2}
EndFunction

Int Function FirstStatusGlobal() Global
  Return ${2 + LOCATION_SLOTS * 2 + references.length * 2}
EndFunction

Int Function ReferenceCount() Global
  Return ${references.length}
EndFunction

String Function ReferencePlugin(Int aiIndex) Global
${references.map((form, i) => `  If aiIndex == ${i}\n    Return ${papyrusString(form.split("|")[0])}\n  EndIf`).join("\n")}
  Return ""
EndFunction

Int Function ReferenceLocal(Int aiIndex) Global
${references.map((form, i) => `  If aiIndex == ${i}\n    Return ${localOf(form)}\n  EndIf`).join("\n")}
  Return 0
EndFunction

; Quest ids in database order: a quest's status goes to global FirstStatusGlobal() + index / 8.
String[] Function Page(Int aiPage) Global
${pages.map((page, p) => `  If aiPage == ${p}\n    String[] ids = new String[${page.length}]\n${page.map((id, i) => `    ids[${i}] = ${papyrusString(id)}`).join("\n")}\n    Return ids\n  EndIf`).join("\n")}
  Return None
EndFunction
`;
const genPapyrus = join(out, "gen/papyrus/CompletionistProto");
mkdirSync(genPapyrus, { recursive: true });
writeFileSync(join(genPapyrus, "Ids.psc"), ids);

// The feed reads statuses from the Nexus edition's tracker (installed through Vortex), so it
// compiles against the tracker's source and the generated QuestData.psc from build:mod.
const questDataPsc = join(repo, "build/papyrus/Completionist/QuestData.psc");
if (!existsSync(questDataPsc)) {
  const build = spawnSync(process.execPath, [join(repo, "tools/build/build-mod.ts"), ...(args.game ? ["--game", args.game] : [])], { stdio: "inherit" });
  if (build.status !== 0) throw new Error("build:mod failed");
}
const compiler = join(gamePath, "Tools/Papyrus Compiler/PapyrusCompiler.exe");
const baseScripts = join(repo, "build/sf-scripts");
const imports = [join(protoSrc, "papyrus"), join(out, "gen/papyrus"), join(repo, "papyrus/Source"), join(repo, "papyrus/vendor"), join(repo, "build/papyrus"), baseScripts].join(";");
for (const script of ["CompletionistProto:Ids", "CompletionistProto:Feed"]) {
  run(compiler, [script, `-f=${join(baseScripts, "Starfield_Papyrus_Flags.flg")}`, `-i=${imports}`, `-o=${join(stage, "Scripts")}`], `Papyrus ${script}`);
}

const archive = join(packageDir, "CompletionistProto - Main.ba2");
run(
  join(gamePath, "Tools/Archive2/Archive2.exe"),
  [`${join(stage, "Interface")},${join(stage, "Scripts")}`, `-c=${archive}`, `-r=${stage}`, "-f=General", "-compression=None"],
  "Archive2",
);

// ---------------------------------------------------------------- 6. zip for Vortex

const zip = join(out, "CompletionistMissionsPrototype.zip");
const tar = join(process.env.SystemRoot ?? "C:/Windows", "System32/tar.exe");
run(tar, ["-a", "-c", "-f", zip, "-C", packageDir, PLUGIN, "CompletionistProto - Main.ba2"], "zip");
cpSync(join(protoSrc, "README.md"), join(out, "README.md"));

const size = (p: string) => `${(statSync(p).size / 1024).toFixed(1)} KB`;
console.log(`
Built:
  ${join(stage, "Interface/missionmenu.swf")} (${size(join(stage, "Interface/missionmenu.swf"))}, vanilla ${size(join(out, "vanilla/missionmenu.swf"))})
  ${join(stage, "Interface/missionmenu_lrg.swf")} (${size(join(stage, "Interface/missionmenu_lrg.swf"))})
  ${join(stage, "Interface/Completionist/CompletionistMissions.swf")} (${size(join(stage, "Interface/Completionist/CompletionistMissions.swf"))})
  ${zip} (${size(zip)})  <- install this through Vortex`);
copyFileSync(zip, join(out, "..", "CompletionistMissionsPrototype.zip"));
