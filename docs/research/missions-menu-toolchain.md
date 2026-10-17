# How to build and maintain a replaced Missions menu

**Ticket:** [#11](https://github.com/rixbrnn/starfield-completionist/issues/11), "How to build and maintain a replaced Missions menu" (map [#1](https://github.com/rixbrnn/starfield-completionist/issues/1), Creations edition)
**Status:** answered from the game's own interface archive (read in place), tool sources and docs, Compact Mission UI's Nexus and Creations pages, and Bethesda's patch notes (2026-10-16). Nothing was built, run in game or tried on a console. Every "unverified" below is a job for the prototype ([#5](https://github.com/rixbrnn/starfield-completionist/issues/5)).
**Builds on:** [#10 replacement SWF menus](https://github.com/rixbrnn/starfield-completionist/blob/research/replacement-swf-menus/docs/research/replacement-swf-menus.md), [#2 platform rules](https://github.com/rixbrnn/starfield-completionist/blob/research/creations-platform-rules/docs/research/creations-platform-rules.md), [#4 build and upload](https://github.com/rixbrnn/starfield-completionist/blob/research/creation-build-upload/docs/research/creation-build-upload.md).

## Short answer

- **It can all run from our build, with no GUI.** The mission menu is a plain compressed SWF (version 12, 30 fps, 1920×1080, one ABC block). It isn't a Scaleform `.gfx` file. Two free, command-line, Java-based tools cover everything:
  - **JPEXS FFDec** decompiles a SWF, diffs it and patches it (`-export script`, `-swf2xml`, `-importScript`, `-replace`, `-header`).
  - **Apache Flex `mxmlc`** compiles our own AS3 into a SWF the game loads. Venworks already does this in a script for a Creation on PC, Xbox and PS5.
  - Adobe Animate is only needed to open an FLA by hand. The Creation-Hub/Interface kit is an FLA export of game **1.10.32**, so it's two years stale and good for reading only.
- **Recommended shape: a thin hook plus our own SWF.**
  - Patch the vanilla `missionmenu.swf` and `missionmenu_lrg.swf` minimally, so they load `Interface/Completionist/…swf`.
  - Build that SWF from our own source, with the quest database compiled in.
  - The vanilla-derived part stays a few lines, the work of porting it forward stays small, and we never commit Bethesda code.
- **Compact Mission UI has no public source.** Its permissions forbid modifying it without asking. It ships just the two SWFs, 3 KB bigger than vanilla, which suggests a patched vanilla file rather than a rebuilt one (inference).
  - It was updated for **1.7.36, 1.12.30 and 1.16.236**, the same day on Nexus and two days later on Creations.
  - It skipped 1.15.222, whose notes say "Minor improvements to sorting in the Missions Menu".
- **Game updates:**
  - Between 1.10.32 and 1.16.244 the menu gained Trackers Alliance, Terran Armada and Creations icons. Paradiso was already there in 1.10.32, a small correction to #10.
  - Its timeline symbols were renumbered between those versions (for example `SideNameBar_30` became `_31`).
  - To port forward: extract the new vanilla files, decompile old and new, diff them, re-apply the hook. The build can detect a new vanilla file by its hash.
- **One SWF pair for all three platforms** (strong evidence, not proof):
  - Vanilla's PC SWF already holds the PS and Xbox code paths.
  - Compact Mission UI is 1.37 MB on every platform.
  - Venworks packs identical files into `Main`, `Main_XBox` and `Main_PS` archives.
  - So there are three archives, as #4 found, but one build of the files.
- **The database is small:**
  - quests only: about 46 KB (12 KB compressed)
  - everything the Nexus menu ships: 622 KB (105 KB compressed), two thirds of it location names
  - for comparison, the vanilla menu is 713 KB
  - One open problem: DLC and Creation quests (73 of 378) have load-order-dependent FormIDs, which the SWF can't work out by itself.

## How trust is labelled

- **SF-verified**: read from this PC install, game 1.16.244 (`Data/Starfield - Interface.ba2`, dated 2026-08-16), opened in place with `tools/esm/ba2.ts` and two scratch scripts: a SWF tag lister and an AS3 string-pool dump. Nothing extracted was committed or copied into the repo.
- **Decompiled**: [Creation-Hub/Interface](https://github.com/Creation-Hub/Interface) @ `8b20208` (vanilla AS3 and XFL from game 1.10.32), read through the GitHub API.
- **Tool source/docs**: JPEXS FFDec's own repo (`help.txt`, `CommandLineArgumentParser.java`, README at tag `version26.3.0`), Apache Flex release pages.
- **Mod author**: an author's own pages or repo about their own mod (Stentorious on Nexus and Creations, monster-cookie's Venworks repo).
- **Bethesda**: patch notes from Steam's news API (`ISteamNews/GetNewsForApp`, appid 1716740), Creations catalog pages.
- **Secondary**: press coverage, labelled where used.
- **Unverified**: nothing found either way.

## What the file is

SF-verified, from `Starfield - Interface.ba2` (1.16.244):

| | `missionmenu.swf` | `missionmenu_lrg.swf` |
|---|---|---|
| File / uncompressed | 713,299 / 786,169 bytes | 713,554 / 786,371 bytes |
| Header | `CWS` (zlib), SWF version 12, 30 fps, 1 frame | same |
| AS3 | 1 `DoABC` tag, 107,155 bytes | 1 `DoABC`, 107,197 bytes |
| Runtime imports (`ImportAssets2`) | `fonts_en.swf`, `Factions.swf`, `ButtonClips.swf` | `fonts_en.swf`, `Factions.swf`, `ButtonClips_LRG.swf` |
| Exported classes | 18, starting `MissionMenu`, `MissionsList`, `MissionInfo`, `CategoryTab`, `MissionsListEntry`… | same, with `MissionMenu_LRG_fla.*` timeline classes |
| GFx exporter tags | none | none |

- **The two files run the same code.** Their AS3 string pools (1,862 strings) differ only in the timeline class prefix (`MissionMenu_fla` against `MissionMenu_LRG_fla`) and one `_LRG` string. The large-text file differs in layout (one more sprite and shape) and in which button clips it imports. So one code change applies to both. Only the layout differs.
- **It's a plain Flash SWF, not a GFx file.** In this archive, 29 movies have a `.gfx` twin made by Scaleform's exporter (`GFx_ExporterInfo` tag): the HUD family, `fonts_en`, `buttonclips`, `factions`. The mission menu has none. That's also why Venworks (a HUD replacer) had to ship both names and Compact Mission UI doesn't.
- **Vanilla stores every SWF uncompressed inside the BA2** (packed size 0). The SWF is already zlib-compressed on the inside.
- **It runs Bethesda's shared AS3 framework.** That includes `Shared.AS3.Data:BSUIDataManager`, `UIDataShuttleTestConnector`, a JSON decoder (`com.adobe.serialization.json:JSONDecoder`), `SymbolLoaderClip` and `scaleform.gfx:Extensions`, and platform code for every console (`PLATFORM_PC_GAMEPAD`, `PLATFORM_XB1`, `PLATFORM_PS4`, `Xenon_*` and `PSN_*` button names). See [one SWF or per platform](#one-swf-or-one-per-platform).

## Toolchain

| Tool | What it does for us | Headless? | Availability |
|---|---|---|---|
| **JPEXS Free Flash Decompiler (FFDec)** 26.3.0, 2026-09-14 | Decompile (`-export script`, to AS3 or P-code), whole-file XML (`-swf2xml` / `-xml2swf`), export to FLA/XFL (`-export fla`/`xfl`), recompile classes into an existing SWF (`-importScript <in> <out> <folder>`), replace one script, image or binary (`-replace`, including P-code by method-body index), set header values (`-header -set framerate 60`), merge or clean ABC, compress/decompress | **Yes.** Every one of these is a CLI command (`help.txt`). The README also ships a Dockerfile for "headless running" | GPL-3.0, needs Java. Its AS3 compiler is built in; it can use the Flex SDK instead (`useFlexAs3Compiler`, `flexSdkLocation` config) |
| **Apache Flex SDK** (`mxmlc`) 4.16.1, 2017-11-22, the last release | Compiles our own AS3 source to a SWF | **Yes.** Venworks' build runs `java -jar mxmlc.jar … -target-player=11.1.0 -swf-version=12 -default-size=1920,1080 -default-frame-rate=30` (`Tools/buildCanvasConsumers.ps1`). That matches vanilla's header exactly | Apache-2.0, needs Java plus Adobe's `playerglobal.swc` 11.1, which isn't in the SDK zip (fetch once, don't commit) |
| **Adobe Animate** | Opens FLA/XFL projects (such as the Creation-Hub kit) and publishes them | **No.** It's a desktop app. JSFL scripting still runs inside it (unverified for our case) | Subscription. Adobe announced its shutdown in Feb 2026, then reversed it and put Animate in "maintenance mode" (secondary: [TechCrunch](https://techcrunch.com/2026/02/04/after-backlash-adobe-cancels-adobe-animate-shutdown-and-puts-app-on-maintenance-mode)) |
| **Creation-Hub/Interface kit** | XFL projects plus decompiled AS3 for every vanilla menu | n/a (Animate projects) | Game **1.10.32**, last commit 2024-05-19, no licence file. `DOMDocument.xml` says "Saved by JPEXS Free Flash Decompiler v.20.1.0", so the kit is itself an FFDec export. There's only `MissionMenu.fla`, no `_LRG` project. Its README: "reconstructed in certain areas" |
| **Scaleform GFx exporter** | Makes the `.gfx` twins | n/a | Not needed for the mission menu (no `.gfx` twin). Autodesk's Scaleform SDK isn't publicly available (unverified whether any licence route exists) |
| **Our own `tools/`** | `tools/esm/ba2.ts` reads the vanilla SWFs from the player's install; `tools/extract/swf.ts` already parses SWF tags | Yes | Ours |
| **Archive2.exe** (Creation Kit) | Packs the BA2s (#4) | Yes | Windows, Creation Kit |

**Verdict:** the whole chain runs from `tools/build/` on the maintainer's Windows PC: Node, Java, FFDec, the Flex SDK, Archive2. That PC is already required for the Papyrus compiler and Archive2 (#4). No GUI is needed, except to inspect things by hand while porting. A CI runner still can't do it, because it needs the vanilla SWFs from an installed, owned game.

### How Venworks does it (mod author: [monster-cookie/venworks-honkcore-ta-ui](https://github.com/monster-cookie/venworks-honkcore-ta-ui), GPL-3.0)

The only public, scripted Starfield Scaleform build found. It's a Creation for PC, Xbox and PS5 with a HUD written "from the ground up in Scaleform and ActionScript 3":

- `docs/BUILDSYSTEM.md` toolchain: Java plus the Apache Flex SDK (with the 11.1 player library), the Papyrus compiler, Spriggit CLI (ESM) and Archive2 (BA2s).
- It compiles `normal.swf` with `mxmlc` and copies it to `large.swf` ("two identical consumer movie aliases").
- It writes three BA2s, `Main`, `Main_XBox` and `Main_PS`, all `-format=General -compression=None` with the same file list (`Tools/createPackages.ps1`). So the same SWF goes to all three platforms.
- It hashes and checks the SWF header, frame rate and bytecode tokens of every build (`Tools/sharedScaleformMovies.ps1`, `verifyVariant.ps1`). That's a pattern worth copying.
- A caution: its changelog records a long PS5 startup-crash hunt with a replaced HUD, ending in "I've had to disable PS5", with HUD loading moved into a separate SWF framework (Venworks Canvas). That's the HUD, not the mission menu (#2, #10). Compact Mission UI is the counter-example that works on PS5.

## How Compact Mission UI is made and kept current

From the author's own pages ([Nexus mod 682](https://www.nexusmods.com/starfield/mods/682), [Creations: free](https://creations.bethesda.net/en/starfield/details/51dab2d2-c610-4317-a6bf-144c92cb44b4/Compact_Mission_UI), [Creations: Achievement Friendly](https://creations.bethesda.net/en/starfield/details/e1d36498-3d58-4de9-bb88-c440b8e73518/Compact_Mission_UI___Achievement_Friendly), read 2026-10-16):

- **Source: not public.** Stentorious has 62 public GitHub repos, none for Starfield (they're Fallout New Vegas and Fallout 4 mods). Nexus permissions: "You must get permission from me before you are allowed to modify my files", "You must get permission from me before you are allowed to use any of the assets", and no asset use in paid files. The Creations page says to reach the author on Nexus or the Bethesda Game Studios Discord.
- **What ships:** the Nexus 3.0.0 zip holds only `Interface/missionmenu.swf` (716.3 kB) and `Interface/missionmenu_lrg.swf` (716.6 kB), per the "Preview file contents" list. Vanilla 1.16.244 is 713.3 kB / 713.6 kB. A patch of about 3 KB to the vanilla files fits an in-place FFDec edit better than a fresh Animate publish. That's an **inference**: we didn't download or open its SWFs. Its "60 FPS menu" option matches a header frame-rate change (vanilla is 30 fps); also an inference.
- **Creations:** both the free one and the "Identical to free version" paid one (100 credits) list v1.01, 1.37 MB on PlayStation, Xbox and PC, last updated Apr 9, 2026. The free one has about 173k PS, 556k Xbox and 313k PC plays. History: 1.00 (4/15/2025) and 1.01 (4/9/2026), "Major: Updated for Starfield 1.16.236". The same size on all three platforms is consistent with one pair of SWFs everywhere.
- **Its compatibility statement:** "Incompatible with any creation modifying the following interface components: missionmenu.swf".
- **Update history** (Nexus changelog): 1.0 (Sep 2023) … 1.7 "Updated for Starfield 1.7.36", 1.9 "Updated for Starfield 1.12.30", 3.0.0 "Updated for Starfield 1.16.236" (uploaded 7 Apr 2026, 8:24 PM, the day the update came out). Other versions are features and fixes: large-font support (1.3), quest timer (2.1, 2.2), vanilla scroll and highlight bug fixes.
- **So it tracks the game like this:** one author re-applies the changes after an update that breaks or visibly changes the menu, re-releases on Nexus that day and on Creations within about two days (review included). Updates that don't break the menu are skipped. 1.15.222 (Aug 2025, "Minor improvements to sorting in the Missions Menu", Bethesda notes) got no Compact Mission UI release. Whether that sorting change lives in the SWF or the engine is **unverified**. If it's in the SWF, CMUI users went 8 months without it.

## What game updates change, and how to port forward

### Observed changes

- **1.10.32 → 1.16.244** (decompiled kit against SF-verified string pool):
  - New faction support in the menu: `FACTION_TRACKERSALLIANCE`, `FACTION_TERRANARMADA`, `FACTION_CREATIONS`, `CreationsFactionHolder(_mc)`, `TrackersAllianceColorIcon`, `TerranArmadaColorIcon`, `$TrackersAlliance`, `$TerranArmada`.
  - **`FACTION_PARADISO` is not new.** It's already in 1.10.32's `Shared/FactionUtils.as`. That corrects #10 and the ticket text. The faction constants are sequential enums (`EnumHelper.GetEnum()`), so a new one inserted mid-list would shift the numbers of the later ones. Whether that happened is **unverified** (needs a decompile of 1.16.244). It would be the kind of change that silently mislabels quests in a stale copy.
  - Timeline symbols renumbered: `SideNameBar_30` → `_31`, `MissionVisuals_42` → `_43`, `ObjectiveIcon_41` → `_42`, `ObjectiveVisuals_38` → `_39`. So library items were added. A 1.10.32 FLA can't just be republished for 1.16.244.
- **Bethesda's notes that touch the menu:** 1.15.222 (Aug 5, 2025) "Minor improvements to sorting in the Missions Menu". 1.16.236 (Apr 7, 2026, Free Lanes plus Terran Armada) brought the new factions and Compact Mission UI's last forced update. 1.16.242 and 1.16.244 notes don't mention the mission menu, and Compact Mission UI hasn't updated since 1.16.236 (consistent, not proof).
- **Rate:** in about three years, three updates forced a Compact Mission UI re-release (1.7.36, 1.12.30, 1.16.236) and at least one more touched the menu (1.15.222). Expect roughly **one forced port a year**, bunched around big content updates.
- **Warning time:** Bethesda posted several update notes a week or two before release, and in 2023 and early 2024 shipped Steam opt-in betas (1.8.84, 1.8.87 and others; "AMD's FSR 3" post, Feb 2024). No 2025–2026 note mentions a Steam beta. **Unverified** whether one will be offered next time.

### Porting process (all scriptable)

1. **Detect.** The build reads both vanilla SWFs from the installed `Starfield - Interface.ba2` (as this research did) and compares their SHA-256 with a committed manifest (`game version → hash`; hashes only, no game data). A mismatch stops the release build: "the game's missionmenu.swf changed; port the hook".
2. **Diff.** Into `build/` (git-ignored): `ffdec -export script` of the old and new vanilla files, then `diff -r`; `ffdec -swf2xml` of both for timeline and layout changes. Also diff the AS3 string pools (scratch script used here): new or removed provider fields (`QuestData.aQuests[].…`) and event names are the breaking ones for our SWF.
3. **Check contracts.** Keep a list of the identifiers our code relies on (provider names, fields, the class and method the hook goes into) and fail the build if any is missing from the new pool. That turns "the menu silently breaks" into a build error.
4. **Re-apply the hook** (next section) and rebuild both files, then repack the three archives and upload by hand per platform (#4), twice if the paid copy happens (#13).
5. **Test** on PC with SFSE off, in normal and large-text mode. Before announcing, test on PS5 hardware or with a tester (#2).

### Keep the vanilla-derived part tiny

The amount of vanilla we change sets the cost of every port. Three ways to build it:

| Approach | How | Port cost per update | Notes |
|---|---|---|---|
| **A. Thin hook + our own SWF** (recommended) | FFDec patches one spot in the vanilla `MissionMenu` class of both files: load `Interface/Completionist/Completionist.swf` with a `Loader` and hand it the menu instance. Everything else (screen, data, logic) lives in our SWF, compiled by `mxmlc` from our own source | Re-apply a few lines. Our SWF only breaks if a provider field changes | Vanilla menus already load SWFs at runtime (`SymbolLoaderClip`, `DataMenu` → `SkillPatches.swf`, #10). If our SWF is missing, the menu stays vanilla. The database is stored once, not twice. **Unverified:** loading a SWF from a Creation's BA2 on console; fonts (`$MAIN_Font` etc.) working in a child SWF |
| B. Edit the vanilla menu throughout | Decompile, change many classes and layouts, recompile with `-importScript` or Animate | Re-do every change against each new vanilla | What Compact Mission UI appears to do. Decompiled AS3 doesn't always recompile cleanly (the kit needed "reconstructed" areas) |
| C. Write the whole menu ourselves | A from-scratch `MissionMenu` in AS3, built by `mxmlc`, Venworks-style | No vanilla copy to go stale, only the engine contract | We'd re-implement every vanilla feature (tracking, plot, categories, timers, buttons for each platform) and lose the menu's own runtime font and button imports. Far too big |

For A, the hook should be written as a scripted edit: the build finds an anchor in the freshly decompiled vanilla class, inserts our lines and recompiles that class with `ffdec -importScript`. That way no decompiled Bethesda code is ever committed, and the patch is a short script plus our own AS3. A P-code patch (`-replace … <methodBodyIndex>`) is the fallback if the decompiled class won't recompile. Whether `-importScript` round-trips this ABC unchanged except for our edit is **unverified**; the prototype should check by comparing the `-swf2xml` of input and output.

Licensing note (not legal advice): the shipped `missionmenu.swf` is a modified Bethesda file, as with every menu replacer on Creations. Keeping our code in a separate SWF of our own keeps our GPL code separate from Bethesda's.

## One SWF or one per platform

**One pair of SWFs; three archives with the same files.** Evidence:

- **SF-verified:** the PC `missionmenu.swf` contains the console code paths: `PLATFORM_XB1`, `PLATFORM_PS4`, `PLATFORM_PC_GAMEPAD`, and every `Xenon_*` and `PSN_*` button name (`Shared:PlatformUtils`, `ButtonControls`). The SWF chooses its platform at runtime from `uiPlatform`. Whether the console builds of the game ship byte-identical vanilla SWFs is **unverified**: console archives can't be read here.
- **Mod author / Bethesda catalog:** Compact Mission UI ships two SWFs on Nexus, and its Creations build is 1.37 MB on all three platforms. Venworks packs one compiled SWF into `Main`, `Main_XBox` and `Main_PS` (all General, uncompressed).
- **#4:** the Creation Kit uploads per platform, each with its own archives. So the build writes `StarfieldCompletionist - Main.ba2`, `- Main_XBox.ba2` and `- Main_PS.ba2` from one staging folder. The exact Xbox and PS names and whether a PC archive would do are the open #4 item; Venworks' names are the best evidence so far.
- Large text: both `missionmenu.swf` and `missionmenu_lrg.swf` must be replaced (the engine picks `_lrg` when large text mode is on). Compact Mission UI ships both. With approach A, each gets the same hook. Our SWF can either copy itself under two names (Venworks) or check text size at runtime.

## Embedding the quest database

### Size (measured from this repo's data, 2026-10-16)

| Data set | Raw | zlib (SWFs are zlib-compressed) |
|---|---|---|
| Quests only: FormID, name, type, start place, objective indices; plus the place tree (378 quests, 136 places) | 45.6 KB | 11.6 KB |
| The Nexus menu's `data.js` minus location names (quests, places, systems, questlines) | 203 KB | 46 KB |
| The Nexus menu's whole `data.js` (with 10,252 location and actor names) | 622 KB | 105 KB |
| For scale: vanilla `missionmenu.swf` | 786 KB | 713 KB |

Even the full set adds about 15% to one SWF. That's no problem for Creations (2 GB per Creation, #2). With approach A it's stored once in our SWF, not once per menu file. The 418 KB of names come from the player's game files at build time (`build/extract/names.json`, never committed). Shipping them inside the Creation is shipping Bethesda's strings, in English only. The menu gets localized quest names from `QuestData.sName` only for quests in the log. Translations are out of scope (map).

### How to embed

1. **Generated AS3 source (recommended):** `build-mod.ts` already turns `data/quests/*.json` into `QuestData.psc` and the Nexus `data.js`. A third emitter writes `QuestDatabase.as`, either as array literals or as one JSON string constant that the menu's own `JSONDecoder` reads. `mxmlc` compiles it into `Completionist.swf`. No runtime file access is needed.
   - Whether a 200 KB string constant parses fast enough on console is **unverified**; array literals need no parsing.
   - Whether Scaleform has the native `JSON` class (Flash 11) is **unverified**. Vanilla bundles its own JSON decoder, which suggests it isn't relied on.
2. `[Embed(mimeType="application/octet-stream")]` binary data: **unverified** under Scaleform; no reason to prefer it.
3. A loose JSON file next to the SWF, loaded with `URLLoader` (vanilla's `UIDataShuttleTestConnector` loads `../Interface/Providers/<name>.json`): **unverified** from a Creation's BA2 on console (#10). Avoid.

### FormID matching: an open design problem

`QuestData.aQuests[].uID` is the runtime FormID (#10). For `Starfield.esm` quests (305 of 378) that equals our stored ID. The other **73** live in `ShatteredSpace.esm`, `SFBGS003/00D/050.esm`. Their runtime prefix depends on load order and on full, medium or small master slots, so the SWF can't compute it.

- **Option 1:** Papyrus works out each plugin's runtime prefix (`Game.GetFormFromFile(...)` then `Form.GetFormID()`, both vanilla natives) and passes it through a `<Global=…>` in our quest's objective text, the channel #10 found.
- **Option 2:** match on the low bits plus `sName`.

Both are **unverified**. Settle it in the prototype.

## What this means for other tickets

- **#5 (prototype):**
  - Build approach A end to end from `tools/build/`: FFDec hook into both vanilla files, `mxmlc` for `Completionist.swf`, one staging folder packed into three BA2s.
  - Test:
    1. a child SWF loads from our BA2 with SFSE off
    2. game fonts render in the child SWF
    3. `-importScript` round-trip leaves the rest of the SWF intact
    4. the database load time
    5. the DLC FormID prefix channel
    6. large text mode
- **#8 (two editions in one repo):** the Creations edition adds an AS3 source tree (ours), a third emitter for the quest database, and build steps that need Java, FFDec and the Flex SDK, plus a committed hash manifest of the vanilla SWFs. **The Nexus menu (`ui/menu/`, HTML/JS for OSF UI) can't run in Scaleform**, so the views have to be written a second time in AS3. Only the data and its generator are shared. That's a real scope item for the map.
- **#12 (coexisting with Compact Mission UI):**
  - Both replace the same two files, and nothing merges them on console. CMUI forbids modification without permission and has no public source.
  - The thin hook makes a **joint file** realistic: CMUI's SWF plus our few-line loader that does nothing when `Completionist.swf` is absent. That needs Stentorious's agreement (and for the paid copy, his "no assets in sold files" rule matters).
  - Otherwise the choice is load order or replacing CMUI's features ourselves.
- **Map scope / "Fallback when the Missions menu breaks":** a stale replacement usually keeps working; CMUI ran 8 months on a pre-1.15.222 base. The real breakages come when a provider field or a faction enum changes. The hash check catches every vanilla change at build time, but players see nothing until our re-upload passes review: CMUI managed about two days. Expect about one forced port a year, three uploads each (six with a paid copy).

## Sources

- **Game files, PC 1.16.244:** `Data/Starfield - Interface.ba2`: `interface/missionmenu.swf`, `missionmenu_lrg.swf`, `messageboxmenu.swf`, `factions.swf/.gfx`, `fonts_en.swf/.gfx`, the full entry list (250 `.swf`, 29 `.gfx`). Read in place with `tools/esm/ba2.ts`, a scratch SWF tag lister and a scratch AS3 string-pool dump. Vanilla Papyrus `Form.psc` (`GetFormID`), `Game.psc` (`GetFormFromFile`) in `build/sf-scripts`.
- **Decompiled 1.10.32:** [Creation-Hub/Interface](https://github.com/Creation-Hub/Interface) @ `8b20208`: `README.md`, `Interface/Source/Bethesda.MissionMenu/` (`MissionMenu.fla/DOMDocument.xml`, `PublishSettings.xml`, `*.as`), `Interface/Source/Bethesda/Shared/FactionUtils.as`.
- **JPEXS FFDec:** [repo](https://github.com/jindrapetrik/jpexs-decompiler) (GPL-3.0), release `version26.3.0` (2026-09-14): `src/com/jpexs/decompiler/flash/console/help.txt`, `CommandLineArgumentParser.java`, `README.md` (Docker/headless).
- **Apache Flex SDK 4.16.1:** [release catalog](https://release-catalog.apache.org/flex/4.16.1/index.html), [announcement](https://blogsarchive.apache.org/flex/entry/apache-flex-4-16-1).
- **Venworks (mod author):** [monster-cookie/venworks-honkcore-ta-ui](https://github.com/monster-cookie/venworks-honkcore-ta-ui): `README.md`, `docs/BUILDSYSTEM.md`, `CHANGELOG.md`, `Tools/buildCanvasConsumers.ps1`, `Tools/createPackages.ps1`, `Tools/sharedScaleformMovies.ps1`.
- **Compact Mission UI (mod author):** [Nexus 682](https://www.nexusmods.com/starfield/mods/682) (description, permissions, changelog, files tab and file preview); Creations [free](https://creations.bethesda.net/en/starfield/details/51dab2d2-c610-4317-a6bf-144c92cb44b4/Compact_Mission_UI) (overview, history, details) and [Achievement Friendly](https://creations.bethesda.net/en/starfield/details/e1d36498-3d58-4de9-bb88-c440b8e73518/Compact_Mission_UI___Achievement_Friendly); [Stentorious on GitHub](https://github.com/Stentorious) (no Starfield repos).
- **Bethesda patch notes** (Steam news API, appid 1716740): 1.15.222 (Aug 5, 2025), 1.16.236 (Apr 7, 2026), 1.16.242 (May 14, 2026), 1.16.244 (Jun 11, 2026), and the 2023–24 Steam beta notes (1.8.84, 1.8.87, FSR 3).
- **Secondary:** [TechCrunch, 2026-02-04](https://techcrunch.com/2026/02/04/after-backlash-adobe-cancels-adobe-animate-shutdown-and-puts-app-on-maintenance-mode) (Adobe Animate maintenance mode).
- **This repo:** `data/quests/*.json`, `tools/build/build-mod.ts` (the `data.js` and `QuestData.psc` emitters), the built `data.js` from the last `build:mod`, used for sizes.
