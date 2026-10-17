# Can a replacement interface file show the tracker's data

**Ticket:** [#10](https://github.com/rixbrnn/starfield-completionist/issues/10), "Can a replacement interface file show the tracker's data" (map [#1](https://github.com/rixbrnn/starfield-completionist/issues/1), Creations edition)
**Status:** answered from the game's own interface files and scripts (2026-10-16). Nothing here was tried in game or on a console. Every "unverified" below is a job for the prototype ([#5](https://github.com/rixbrnn/starfield-completionist/issues/5)).
**Builds on:** [#3 vanilla UI surfaces](https://github.com/rixbrnn/starfield-completionist/blob/research/vanilla-ui-surfaces/docs/research/vanilla-ui-surfaces.md) and [#2 platform rules](https://github.com/rixbrnn/starfield-completionist/blob/research/creations-platform-rules/docs/research/creations-platform-rules.md).

## Short answer

**Partly.** A Papyrus-only Creation **can't open a menu of its own**. It can only replace a menu the game already has, and that menu only opens when the game opens it. But a replaced menu can show the tracker's progress, because the text Papyrus already controls reaches the menu as plain strings after the game fills in the tags:

| Replaced file | Who opens it | What Papyrus can put in it | Fit |
|---|---|---|---|
| `messageboxmenu.swf` | Papyrus, from anywhere (`Message.Show`) | Header and body text with `<Global=…>`/`<Alias=…>` tags and 9 numbers; buttons; the pressed button goes back to Papyrus | **Best "own menu" stand-in**: opens anywhere, no world object |
| `genesisterminalmenu.swf` (terminals) | The player at a terminal, or Papyrus `Activate` when close ([#9](https://github.com/rixbrnn/starfield-completionist/issues/9)) | Page text with any number of `<Token.Value=…>` numbers and names, entry lists; entry clicks go back to Papyrus | Richest data channel; tied to having a terminal |
| `missionmenu.swf` (and the data menu) | The player only | The mod's own quest objectives (text with tags, shown/done flags). The menu also gets **every quest in the player's log, completed ones included, with FormIDs** | Natural home for progress, but no Papyrus way to open it, and Compact Mission UI owns this file |
| `playerhudcomponents.swf` (HUD) | Always loaded | Any string at runtime, via `Game.ShowCustomWatchAlert(string)` | The only free-text channel found, but it's a HUD file (the PS5 crash case) |

The Nexus menu's data (a status per quest, a few hundred entries in pages of 128, see `MenuBridge.PublishStatus`) fits through a message box or terminal page made of many tags, or can be partly worked out by the menu itself from the mission log data. All of these go into one shared vanilla file. So the menu has to tell **our** message box or terminal page apart from every other one (by a marker in the text) and draw the vanilla menu for everything else.

The risks are real and point the same way. Only one Creation can provide a given file. Compact Mission UI already provides `missionmenu.swf`. Each replaced file is a full copy of a vanilla menu that has to be redone after game updates. A heavy HUD replacement has crashed on PS5.

## How trust is labelled

- **SF-verified**: read from this PC install's own files, game 1.16.244 (`Starfield - Interface.ba2`, dated 2026-08-16, opened with the repo's `tools/esm/ba2.ts`). The AS3 string pools (the class, field, provider and event names inside each SWF) were dumped by a scratch script. Vanilla Papyrus sources are in `build/sf-scripts`. Nothing extracted was committed.
- **Decompiled**: [Creation-Hub/Interface](https://github.com/Creation-Hub/Interface), "the unofficial Starfield user interface development kit", is the vanilla AS3 decompiled from game **1.10.32** (2024). It was used to read the code's logic. Every name cited from it was checked against the 1.16.244 string pools, and where the two differ, that's said.
- **Mod author**: a mod author's own repo about their own mod.
- **Unverified**: nothing found either way.

## Can a Papyrus-only mod open a menu of its own?

**No** (SF-verified, by absence).

- Starfield menus are engine classes (`IMenu` on the AS3 side; `missionmenu.swf` declares `MissionMenu extends Shared.AS3:IMenu`, and the engine knows it as `BSMissionMenu`). A SWF only runs when the engine opens the menu it belongs to. Opening a menu that doesn't exist yet is what OSF UI (SFSE) adds. CarbonUI/"Star Deck" (an SFSE overlay framework, [repo](https://github.com/CarbonNode/CarbonUI)) is another example. Neither is possible without SFSE.
- Vanilla Papyrus has no "open menu by name". The menu natives in `build/sf-scripts` are fixed: `Message.Show` and `ShowAsHelpMessage` (message box, HUD hint); `Actor.OpenInventory`, `ShowBarterMenu`, `ObjectReference.OpenOneWayTransferMenu`, `ShowCraftingMenu`, `ShowWorkshopBuilderMenu`/`ShowWorkshopTargetMenu`, `ShowHangarMenu`, `ShowCrewAssign`; `Game.ShowGalaxyStarMapMenu(AndPlotToLocation)`, `ShowMissionBoardMenu`, `ShowRaceMenu`, `ShowTitleSequenceMenu`; plus `Activate` on a terminal. **There is no call that opens the mission menu or the data menu.**
- Papyrus can watch menus (`RegisterForMenuOpenCloseEvent`, `OnMenuOpenCloseEvent` in `ScriptObject.psc`) and refresh its data when one opens. Whether the refresh lands before the menu reads its data is **unverified**.
- A replaced menu can **load more SWFs of our own** from `Interface/` at runtime. Vanilla does this all the time (`DataMenu` loads `SkillPatches.swf`, the map menus load `MapIcons.swf`, `SymbolLoaderClip`/`LibraryLoader` load `<name>.swf`; decompiled, names SF-verified in the pools). So the replaced file can be a thin shell that hands off to a `Completionist` SWF. It's still hosted inside, and opened by, a vanilla menu.

## What data a replaced menu receives

Every Starfield menu gets its data the same way. AS3 calls `BSUIDataManager.Subscribe("<provider>", callback)`, the engine's data shuttle "watches" that provider name, and changes come back as `FromClientDataEvent`s (decompiled `Shared/AS3/Data/BSUIDataManager.as`). Clicks go back to the engine as named events (`BSUIDataManager.dispatchEvent(new CustomEvent("MissionMenu_…"))`). The engine handles only the event names it knows. A replacement can't invent new providers or events. It can **subscribe to any provider name the engine already publishes**, though.

Providers per menu (decompiled; names SF-verified in the 1.16.244 pools):

### Mission menu (`missionmenu.swf`): `QuestData`, `MissionMenuStateData`, `MissionMenuStickData`, `FireForgetEventData`

- `QuestData.aQuests[]`: `sName`, `uID` (the quest's FormID), `uInstanceID`, `iType`, `iFaction`, `iRemainingTime`, `bActive`, `bComplete`, `bFailed`, `bIsMiscQuest`, `sDescription`, and `aObjectives[]` (`sName`, `uOwnerQuestFormID`, `uIndex`, `bActive`, `bComplete`, `bFailed`, `bCanShowOnMap`, `bIsMiscObjective`). The menu has a **`$Completed`** tab (`COMPLETED_QUEST_TYPE`, SF-verified in 1.16.244), so completed quests come through too. `DataMenu` also subscribes to `QuestData`.
- Events back: `MissionMenu_ToggleTrackingQuest`, `_PlotToLocation`, `_ShowItemLocation`, `_RejectQuest`, `_TransitionToMap`, `_SaveCategoryIndex`, `_SaveOpenedId`, `_ClearState`, `_ToggleQTDisplay`, `_OnExitMissionMenu`. None of them is a Papyrus event. No vanilla Papyrus event fires on quest tracking.
- **What Papyrus can feed in:** only through quests. The mod's own quest shows up in `aQuests` like any other, so its objectives' text (with `<Global=…>`/`<Alias=…>` already filled in; no vanilla AS3 handles those tags, so the engine resolves them before sending) and their shown/done flags reach the menu. The menu can pick that quest out by `sName`, hide it from the list and draw it as a progress panel.
- **What the menu can work out on its own:** with the quest database built into our SWF at build time (FormID → place, type), the menu can count done and open quests per place from `aQuests` alone, for every quest that has been in the log. It can't see quests that never showed in the log ("not discovered", most activities and errands), and it can't see the tracker's manual overrides. Those still need Papyrus (objectives) or the static totals. Whether every completed quest stays in `aQuests`, including ones finished without ever showing, is **unverified**.
- No location per quest comes through (only `bCanShowOnMap`).

### Terminal (`genesisterminalmenu.swf`): `DesktopViewData`, `FolderViewData`, `DocumentViewData`, `ItemActionData`, `FactionData`

- Fields (SF-verified in the pool): desktop icons `aIcons[]` (`iIconId`, `sIconName`, `bIsLocked`, `iIconStyle`), documents `sHeader`/`sBody`, item actions `iMenuItemIndex`/`iItemActionType`/`bCreatesNewWindow`, `bIsKiosk`, `iFactionId`, images `sDirectory`/`sImageName`. Events back: `Terminal_MenuItemClick`, `Terminal_CloseView`/`CloseTopView`/`CloseAllViews`, `Terminal_DesktopIconHighlighted`.
- **What Papyrus can feed in:** everything #3 found for terminals. Body and entry text with as many `<Token.Value=Label>` numbers and `<Token.Name=Label>` names as the script sets (`AddTextReplacementValue`/`Data`), `<Global=…>`, and runtime entry lists (`AddDynamicMenuItem`). A page body like `CMPL|<Token.Value=S0>,<Token.Value=S1>,…` reaches the SWF as a string of numbers. That is effectively an **arbitrary-size data channel**, limited only by text length (unverified). Entry clicks go back to Papyrus through `OnTerminalMenuItemRun`, so a custom terminal SWF can still drive the tracker (track, plot).
- The SWF gets no terminal FormID, so it has to recognise our terminal by a marker in the header or body.

### Message box (`messageboxmenu.swf`): `MessageBoxMenuData`

- Fields (SF-verified in the pool): `sHeaderText`, `sBodyText`, buttons, `iButtonPressed`, `bAllowBackOut`, `bMenuMode`, `bHasQuestTarget`, image fixture (`sDirectory`, `sImageName`).
- **What Papyrus can feed in:** a Message form's text, resolved: up to 9 `%` numbers from `Show(...)`, plus as many `<Global=…>` tags as the text holds, from the owner quest's text-display globals (#3). With many globals, packed if needed (a float holds 24 bits exactly), one box can carry hundreds of statuses. How many tags one message may hold and how long the resolved text may get is **unverified**. The button pressed goes back to Papyrus as `Show`'s return value, so menus can be chained.
- **It opens from anywhere**, with no world object. That makes a replaced message box the closest thing to "a menu of our own" without SFSE: Papyrus calls `Show`, and our SWF sees the marker and draws the Completionist screen instead of a box.

### Book and data slate (`bookmenu.swf`, `dataslatemenu.swf`): `BookData`, `DataSlateData`

`sTitle`, `sBodyText` (and `sLeftHeaderText`/`sRightHeaderText` on slates). The text is fixed plus names and tokens (#3). Opened by the player from the inventory. It's weaker than a message box.

### HUD (`playerhudcomponents.swf`): `CustomAlertsData`, the one free-text channel

- `Game.ShowCustomWatchAlert(string aAnimName)` ("Shows a custom watch animation on the HUD watch", `Game.psc`; not `DebugOnly`, so it works in release builds; vanilla calls it once, `"bootup"` in `QF_MQ101`). It arrives as `CustomAlertsData.aAlerts[].sAlertText` in `playerhudcomponents.swf`, which uses it as a frame label (decompiled `BottomLeftGroup.onCustomAlertsDataChange`; all three names SF-verified in the 1.16.244 pool).
- So a replaced HUD component could take **any string Papyrus builds at runtime** (for example `"CMPL:Here:12/30"`) and show a HUD widget. Whether the engine passes the string through unchanged, and how long it may be, is **unverified**. This is the HUD, the area where Venworks crashed on PS5, and the file other HUD mods replace.
- Other HUD providers (`HUDMessageData`, `QuestUpdateData`, `TutorialTips`) carry Message or quest text only. `Debug.Notification` is `DebugOnly` (#2).

### Settings shared with any menu: `PEOData` (Gameplay Options)

- Gameplay Options (`GPOF` records, Bool or Float, xEdit [`wbDefinitionsSF1.pas`](https://github.com/TES5Edit/TES5Edit/blob/dev-4.1.6/Core/wbDefinitionsSF1.pas)) come through `PEOData.aGeneralSettingsList` (vanilla: `pausemenu.swf`, `settingspanel.swf`). The author of Ammo HUD shows the same provider read from inside a replaced `dataslatemenu.swf` and says it "works when your menu is not always there" (mod author: [ProfX66/Starfield-Gameplay-Options-for-UI](https://github.com/ProfX66/Starfield-Gameplay-Options-for-UI), May 2026). Not tested by us. That is also evidence that a provider can be read from a menu that doesn't normally use it.
- Papyrus can **read** an option (`GameplayOption.GetValue()`) but not set it (`GameplayOption.psc` has no setter). So it's a channel for **player settings** that both Papyrus and our SWF see (show the HUD widget? hide activities?). It can't carry progress. This is how StarUI puts its settings in Gameplay Options (#2).

### Static data

The tracker's database (quest → place, names, totals) doesn't have to come from Papyrus at all. The build can compile it into our own SWF. Vanilla can also read JSON next to the interface files (`UIDataShuttleTestConnector` loads `Providers/<name>.json`, and the 1.16.244 archive ships `interface/providers/*.json`), but whether that works for a Creation's archive on console is **unverified**, so building the data in is safer.

## Risks

### PS5 crashes

- Proven fine: *Compact Mission UI* (a full `missionmenu.swf` replacement) is live on PlayStation (#2). Proven bad: *Venworks Customizable HUD* (`hudmenu.gfx` and more) was accepted for PS5 and crashed at startup (#2, author's changelog). The cause isn't public, so **why** is unverified: memory, a HUD-specific path, or something in that SWF.
- So a replacement about the size of the mission menu or message box sits on the proven side. A HUD replacement sits on the side that broke. Either way, it has to be tested on PS5 hardware before release, and a PS5 build can always ship without the SWF (Papyrus-only fallback: plain message boxes, terminals).

### Conflicts with other menu replacers

- A replacement is a whole file at a fixed path. If two Creations ship `interface/missionmenu.swf`, one wins and the other's changes disappear. Which one wins follows load order, the usual Bethesda archive rule; that this holds for Creations on console is assumed, not verified. Nothing merges two SWFs on console: StarDelta-style SWF patching ([hierocles/stardelta](https://github.com/hierocles/stardelta)) is a PC tool the player runs.
- Known owners of these files: Compact Mission UI → `missionmenu.swf`. StarUI → inventory, HUD, workbench, ship builder and outpost menus (#2; its exact file list wasn't read, **unverified**). Venworks → HUD files. Nobody known replaces `messageboxmenu.swf` or `genesisterminalmenu.swf`, but that's a catalog search away from certain (**unverified**).
- Every menu ships twice: `<name>.swf` and `<name>_lrg.swf` (large text mode; the 1.16.244 archive has both for each menu, and vanilla picks `_LRG` files when `LargeTextMode` is on). Both must be replaced.
- Because the replaced message box or terminal menu runs for **every** message box or terminal in the game, a bug in our copy breaks the vanilla game everywhere, not just our screen.

### Game updates

- A replacement is a frozen copy of the vanilla menu plus our changes. When Bethesda changes that menu, the copy goes stale. Evidence: the 1.10.32 mission menu (decompiled) knows 7 faction icons. The 1.16.244 one adds Trackers Alliance, Terran Armada, Paradiso and Creations (`FACTION_TRACKERSALLIANCE`, `FACTION_TERRANARMADA`, `FACTION_PARADISO`, `FACTION_CREATIONS`, `CreationsFactionHolder` in the pool). A replacement built on 1.10.32 would show no icon for those quests, and a changed provider field could break it outright.
- So every game update means: re-extract the SWF, re-apply our changes, rebuild, re-upload for each platform (#4). The decompiled kit is two years behind (1.10.32), so the build would have to start from the player's current SWF (decompiled with a tool such as JPEXS), not from the kit.
- The Papyrus-fed text channels (objectives, tokens, globals, the watch alert string) are ordinary engine features and less likely to change than the menus' internals.

## What this means for the Creations edition

1. **The answer is no to "a menu of our own" and yes to "our screen inside a vanilla menu".** The closest stand-in for the Nexus menu is a **replaced message box**: Papyrus opens it from anywhere with `Message.Show`, fills it with globals, and our SWF draws the Completionist screen when it sees our marker. The pressed buttons come back to Papyrus. A replaced **terminal** menu carries more data (tokens) but needs a terminal (#9).
2. **The mission menu is the natural place for a progress view,** and it already gets the player's whole quest log with FormIDs. But the player has to open it, and Compact Mission UI owns the file. At most, an optional extra.
3. **Keep the plain Papyrus surfaces from #3 as the base** (terminal pages, objectives, plain message boxes), and treat a SWF as an optional layer on top. Every platform build must still work if the SWF loses a conflict or is left out (PS5).
4. Settings go in **Gameplay Options**, which both Papyrus and the SWF can read.
5. Cost: shipping a SWF adds a Flash/AS3 toolchain, two files per menu, a rebuild after every game update, and a PS5 hardware test. That's a big step up from a Papyrus- and ESM-only Creation.

### For the prototype (#5)

Test in this order:

1. A replaced `messageboxmenu.swf` + `_lrg` that only logs/echoes `sBodyText`. Check whether 200 `<Global=…>` tags resolve, how long the text may be, and whether the vanilla boxes still work. Then run it on PS5.
2. The `ShowCustomWatchAlert` string arriving unchanged in a replaced `playerhudcomponents.swf`.
3. Whether a provider (`QuestData`, `PEOData`) can be read from a menu that doesn't normally use it.
4. Whether `RegisterForMenuOpenCloseEvent` updates land before the menu reads them.

## Sources

- Game files, PC 1.16.244: `Data/Starfield - Interface.ba2` (`interface/missionmenu.swf`, `genesisterminalmenu.swf`, `messageboxmenu.swf`, `bookmenu.swf`, `dataslatemenu.swf`, `datamenu.swf`, `playerhudcomponents.swf`, `hudmenu.swf`, `pausemenu.swf`, `settingspanel.swf`, `*_lrg.swf`, `interface/providers/*.json`), read in place with `tools/esm/ba2.ts` and a scratch AS3 string-pool dump.
- Vanilla Papyrus (`build/sf-scripts`, from the CK's `ContentResources.zip`): `Game.psc` (`ShowCustomWatchAlert`, `ShowMissionBoardMenu`, `ShowGalaxyStarMapMenu`, `HideHudMenus` …), `Message.psc`, `Actor.psc`, `ObjectReference.psc`, `ScriptObject.psc` (`RegisterForMenuOpenCloseEvent`, `OnMenuOpenCloseEvent`), `TerminalMenu.psc`, `GameplayOption.psc`, `Debug.psc`, `Fragments/Quests/QF_MQ101_00003448.psc`.
- Decompiled vanilla AS3, game 1.10.32: [Creation-Hub/Interface](https://github.com/Creation-Hub/Interface) @ `8b20208`: `Shared/AS3/Data/BSUIDataManager.as`, `UIDataShuttleTestConnector.as`, `Bethesda.MissionMenu/*.as`, `Bethesda.DataMenu/DataMenu.as`, `Bethesda.PlayerHUDComponents/BottomLeftGroup.as`, the loaders in `Shared/Components/ContentLoaders/`.
- xEdit Starfield definitions: [`Core/wbDefinitionsSF1.pas`](https://github.com/TES5Edit/TES5Edit/blob/dev-4.1.6/Core/wbDefinitionsSF1.pas) (`GPOF`, `GPOG`).
- Mod authors: [ProfX66/Starfield-Gameplay-Options-for-UI](https://github.com/ProfX66/Starfield-Gameplay-Options-for-UI) (`PEOData` in a replaced data slate), [CarbonNode/CarbonUI](https://github.com/CarbonNode/CarbonUI) (new UI needs SFSE), [hierocles/stardelta](https://github.com/hierocles/stardelta) (PC-side SWF patching).
- Catalog facts (Compact Mission UI on PS5, Venworks PS5 crash, StarUI menus and settings) are from #2, which cites the Creations pages and the Venworks changelog. Compact Mission UI's own SWF wasn't inspected (no Creations installed here, and its page didn't load outside a browser).
