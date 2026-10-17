# Vanilla UI surfaces for a Papyrus-only mod

**Ticket:** [#3](https://github.com/rixbrnn/starfield-completionist/issues/3), "Which parts of the game's own interface a Papyrus-only mod can use" (map [#1](https://github.com/rixbrnn/starfield-completionist/issues/1), Creations edition)
**Status:** answered from Starfield's own data and scripts (2026-10-16). Not yet tried in game. Every "unverified" below is a job for the prototype ([#5](https://github.com/rixbrnn/starfield-completionist/issues/5)).
**Scope:** only what Papyrus and an ESM can do: no SFSE, no OSF UI, no Scaleform edits.

## Short answer

| Surface | Fixed text (from the ESM) | Live values | Live names | Choice / navigation |
|---|---|---|---|---|
| **Terminal** (TERM + TMLM) | Lots: pages and submenus, entries and body texts shown or hidden by conditions | Yes. Script tokens on the terminal ref (`<Token.Value=X>`, unlimited labels), quest globals (`<Global=X>`), values handed to dynamic entries (`<0.ValueInt>`) | Yes (`<Token.Name=X>`, `<Alias=X>`, `<0.Name>`) | Yes. Nested submenus, plus entry lists built at runtime (`AddDynamicMenuItem`) |
| **Own quest objectives** (mission log) | One line per objective (vanilla longest is 146 chars) | Yes, `<Global=X>` (needs Text Display Globals + `UpdateCurrentInstanceGlobal`) | Yes, `<Alias=X>`, which can be a location alias forced at runtime | No (the log only shows them) |
| **Message** (`Message.Show`) | Medium (vanilla message boxes run to about 1,100 chars) | Up to 9 numbers (`%.0f` …) plus `<Global=X>` from the owner quest | `<Alias=X>` from the owner quest | Up to 8 buttons in vanilla, each with conditions; `Show` returns the button pressed, so menus can be chained |
| **Debug.MessageBox / Debug.Notification** | n/a | Anything: the whole string is built at runtime | Anything | No (one OK button) |
| **Help message** (`Message.ShowAsHelpMessage`) | Short HUD hint | Same tags as Message | Same | No |
| **Book / slate** (BOOK) | Lots (vanilla goes to 4,625 chars), with simple markup | Not shown in vanilla (no `<Global>` in any vanilla book) | Yes, `<Alias=X>` and script tokens on the book ref (`<Token.Title=X>`) | No (a terminal entry can open a book, though) |

So only a **terminal** can show a place's whole progress: a list of the quests still missing, each entry shown or hidden by a condition, with live "12/30" counts. The mod's **own quest objectives** can show one live line per place, or one for the current place, in the mission log. Message boxes are the fallback "menu" that needs no world object at all.

What's **not answered** from data: whether a script can open a terminal the player isn't standing at. Fallout 4's portable terminals were holotapes, and Starfield has none (0 NOTE records). See "Opening a terminal from a script".

## How trust is labelled

- **SF-verified**: shown by Starfield's own files. That means the base game Papyrus sources (`Tools/ContentResources.zip` → `Scripts/Source`, extracted to `build/sf-scripts/`, 5,033 scripts) or `Starfield.esm` itself (file dated 2026-08-16), read with the repo's own reader (`tools/esm/plugin.ts`, `tools/esm/strings.ts`). Vanilla using something is proof it works in the shipping game. It isn't proof of limits.
- **xEdit**: record layouts from xEdit's Starfield definitions, [`Core/wbDefinitionsSF1.pas`](https://github.com/TES5Edit/TES5Edit/blob/9fb016884bec138ea6c7b872cec831537d464c3e/Core/wbDefinitionsSF1.pas) (branch `dev-4.1.6`) (records `TMLM`, `TERM`, `MESG`, `QUST`; condition function table at the top). This is reverse-engineered, but it's the reference the modding community builds on.
- **FO4, assumed**: Fallout 4 Creation Kit wiki knowledge assumed to carry over. The falloutck.uesp.net pages sit behind a bot check, so they're cited from search excerpts and weren't read in full.
- **Unverified**: nothing found either way. Needs an in-game test.

## Terminals

### Records (xEdit, SF-verified counts)

A placed terminal is a `TERM` base object whose `DNAM` points to its top `TMLM` (Terminal Menu). `TERM` is furniture-like: it has marker entry points and a furniture template, and the player "enters" it.

A `TMLM` has:
- **Body texts** (`BSIZ` count, then `BTXT` text + conditions + `TPLT` "uses templated text"). All body texts whose conditions pass are shown. Vanilla has up to **9** per menu.
- **Menu items** (`ISIZ` count u32; each has `ITXT` text, `ISTX` short text, `ISET` type/flags, `ITID` id u16, then by type `UNAM` display text / `TNAM` submenu / `BNAM` book, and conditions). Item types: 0 Display Text, 1 Submenu, 3 Return to Previous, 4 Force Redraw, 5 DataSlate (opens a BOOK).
- Optional script (VMAD) with fragments and the `TerminalMenu` events.

Vanilla `Starfield.esm` sizes (SF-verified; vanilla sizes, not engine limits):

| | Count | Median | Max |
|---|---|---|---|
| TMLM records | 700 (186 with a script) | | |
| Items per menu | | | **56** (`CFKey_PublicAccessTerminalMessageBoardSubMenu`) |
| Body texts per menu | | | 9 |
| Conditions per menu | | | 157 |
| Item label (`ITXT`) length | 2,340 | 17 chars | 82 chars |
| Body text (`BTXT`) length | 498 | 95 chars | 1,471 chars |
| Display text (`UNAM`) length | 1,689 | 321 chars | **3,791** chars |

The file format allows more: item counts are u32 and item IDs u16, and a string subrecord can be longer than 64 KB (`XXXX`). Our ESM isn't localized, so strings are written inline. How many entries the terminal list shows before scrolling, and whether a 4,000-char page scrolls, is **unverified** (prototype).

### Conditions on entries and body texts (SF-verified)

Condition functions used in vanilla terminal menus, by count (names from xEdit's table): `GetGlobalValue` (74) ×616, `GetStageDone` (59) ×541, `GetValue` (14, an actor value, often on the terminal ref itself) ×202, **`GetQuestCompleted` (543) ×57**, **`GetVMQuestVariable` (629) ×57**, `GetLocked` ×51, `GetStage` ×47, `GetItemCount` ×24, `GetQuestRunning` ×20, `HasPerk`, `GetIsID`, `GetVMScriptVariable`, `IsResearchComplete` …

For us this means:
- Since the build generates the ESM, it can write **one entry per quest** with `GetQuestCompleted` / `GetStageDone` conditions, for example "show only if not done". That gives a per-place list of missing quests, with no script at all.
- **`GetVMQuestVariable`** lets a condition read a property on a quest's script. A condition can therefore read `QuestTracker`'s own state (a per-place count, or an "overridden" flag) with no global in between. Conditions only compare a number, so this filters entries but can't print a value.
- Actor values on the terminal ref (`akTerminalRef.SetValue(av, n)` + condition `GetValue av`) are how the vendor kiosk hides unused slots (`KioskTerminalVendorScript.psc`).

### Text replacement in terminals (SF-verified tags)

Tags found in vanilla TMLM texts (body, label and display text):

| Tag | Source of the value | Vanilla example |
|---|---|---|
| `<Token.Value=Label>`, `<Token=Label>` | `akTerminalRef.AddTextReplacementValue("Label", float)` | `MQ207CQuestScript` (interlock frequencies), `SE_DerelictTextReplacementScript` (`RandomInt00`…), kiosk prices `<Token=MiscItem0Value>` |
| `<Token.Name=Label>`, `<Token.Title=Label>` | `akTerminalRef.AddTextReplacementData("Label", form)`: the form's name | kiosk `<Token.Name=SaleItem>`, derelict logs `<Token.Title=MiscText04>` (Message forms used as text snippets) |
| `<Global=Name>` | a global listed in a quest's **Text Display Globals** (`QTGL`), refreshed with `Quest.UpdateCurrentInstanceGlobal` | `OE_KT_IncomingStorm_Terminal`: "Generator A = `<Global=OE_KT_IncomingStormGenA_Global>` kW" |
| `<Alias=Name>`, `<Alias.CurrentName=…>`, pronoun forms | a quest alias | derelict ship logs |
| `<0.Name>`, `<1.ValueInt>`, `<2.Title>` | the `Form[]` passed to `AddDynamicMenuItem` / `AddDynamicBodyTextItem`, by index | mission board: "`<0.ValueInt>`Cr, `<1.ValueInt>` `<2.Name>`, supplied to `<3.Name>` in `<4.Name>` system" |

Notes:
- **Script tokens are the most flexible way to show live numbers.** Labels are plain strings, so a script can set any number of them (`"Done" + i`). Vanilla sets them in `OnTerminalMenuEnter`, or in `OnTerminalMenuItemRun` right before the submenu that shows them opens: the kiosk sets `SaleItem` there, and the sale submenu shows `<Token.Name=SaleItem>`. `TerminalMenu.psc` says `OnTerminalMenuItemRun` runs "in parallel with the fragment", and vanilla relies on that timing anyway. How a non-integer `Token.Value` is formatted is **unverified**.
- **One page can serve every place.** Set `<Token.Name=Place>` to a generated Message (or Location) form, and `<Token.Value=Done>` / `<Token.Value=Total>` to that place's numbers, then open one shared submenu. The FO4 wiki says `AddTextReplacementData` "does NOT work for references" (FO4, assumed). In Starfield, `CityCYRedTape01ApplyTerminalScript` passes `Game.GetPlayer().GetBaseObject()`, which fits that, so pass base forms or Messages.
- **`<Global=>`**: in vanilla, every global shown in a terminal or message is in some quest's `QTGL` (224 vanilla quests have one, up to 17 globals each), and the owning script calls `UpdateCurrentInstanceGlobal` after each change (`OE_KT_IncomingStormTerminalScript.psc`). The FO4 wiki says `UpdateCurrentInstanceGlobal` fails if "the global isn't in the quest's text global list" (FO4, assumed). How the terminal finds *which* quest's instance to use, since the TMLM has no owner-quest field, is **unverified**. Our guess is that the terminal ref is filled into an alias of that quest (not checked for the vanilla terminals), so the prototype should do that. Tokens avoid the question.
- **Dynamic entries** (`TerminalMenu.AddDynamicMenuItem(ref, templateIndex, itemID, Form[])`, `AddDynamicBodyTextItem`, `ClearDynamic…`, SF-verified natives in `TerminalMenu.psc` and `ObjectReference.psc`): copy a template entry once per call, with its own `<N.…>` replacements. `TestDynamicTerminalScript` builds a random-length list this way, passing `GlobalVariable[]` as the forms (setting the global just before each call). `PlanetTraitTerminalMenuScript` and the Red Tape scripts add dynamic body text with names. **A list of any length, built at runtime, is therefore possible** (for example only the missing quests, with names from generated forms). Whether `<N.ValueInt>` keeps the value from when the entry was added is **unverified**.
- Fixed text tags are resolved when the page is drawn. Item type 4 "Force Redraw" exists, and the Incoming Storm puzzle shows updated globals after each choice on the same terminal (SF-verified).

### Opening a terminal from a script

- Activating a terminal from a script does open it for the player when the player is close. `CF05_TerminalActivationScript.psc` blocks activation, then calls `GetRef().Activate(PlayerRef, true)` to let it go through (SF-verified pattern). `TerminalScript.psc` likewise re-`Activate`s powered terminals.
- **Opening one the player isn't at is unverified.** No vanilla script does it. The Fallout 4 approach was a holotape (a NOTE record with a terminal, played in the Pip-Boy). Starfield has neither: `Starfield.esm` has **0 NOTE records** and no Pip-Boy. Because `TERM` is furniture (entry markers, and the player enters it), `Activate(player)` on a ref in another cell may do nothing, or may move the player. That is the first thing #5 should test.
- If remote opening fails, the terminal has to be somewhere the player can get to. Options, all ESM only, for #6 to weigh: a terminal added to a fixed place (the Lodge, a city), one in a ship habitat module, or an outpost buildable. Or skip the terminal and chain message boxes from an item (next section).

## Messages (`Message.Show`), help messages, Debug

From `Message.psc` and the vanilla data (SF-verified):

- **`Message.Show(9 floats)`** fills `%.0f`, `%.1f`, `%.2f` in the text in order. For example, `SQ_ParentPlanetTraitExploreMessage` reads "(%.0f/%.0f scanned)" and is shown with `.Show(scanCount, scanCountNeeded)` in `SQ_ParentScript.psc`. So 9 live numbers at most.
- Message text also takes `<Alias=…>` and `<Global=…>` from the message's **owner quest** (`QNAM`). For example, the Red Mile leaderboard messages are owned by `DialogueRedMile`, whose `QTGL` lists `PlayerCompletedRedMile`. `SQ_ActorRolesScript.ShowTextReplacedMessage` shows the vanilla way to get a live name: force a ref into an owner-quest alias, `Show`, then clear the alias.
- **Message box** (DNAM flag 0): buttons are `ITXT` entries, each with **conditions** (xEdit); vanilla has up to **8** buttons. `Show` waits for the player and returns the button index, so chained boxes make a menu tree that needs no world object. The longest vanilla box text is about 1,160 chars; how long a box can get before it scrolls or clips is **unverified**.
- Not a box (flag clear): a HUD notification, with the same tags and `%` numbers. `ShowAsHelpMessage(event, duration, interval, maxTimes, …)` shows a HUD help hint, as tutorials do.
- **`Debug.MessageBox(string)` / `Debug.Notification(string)`** (`Debug.psc`): any string built at runtime, so everything in it can be live, but there are no choices and no localization. Vanilla calls them only from debug and test scripts. That they show up in release builds is FO4/Skyrim knowledge, assumed; **check on Xbox and PS5 in #5.** The maximum length is unverified; notifications are HUD lines, so keep them short.
- No surface can **change** a Message's text at runtime, except through tags and `%` numbers (`Message.psc` has no setter).

## Books, slates, datapads

- Starfield's slates and datapads are `BOOK` records (992 in vanilla). Text is in `DESC`: median 240 chars, max **4,625** (`Book_SanctumUniversum02a`). It takes simple markup: `<b>`, `<i>`, `<u>`, `<br>`, `<p align='center'>`, `<font size='70'>` (SF-verified).
- Live text: `<Alias=…>` (treasure-map slates, `SQ_TreasureMap_Created_*`), and a script token on **the book ref**: `FFConstantR02QuestScript` calls `AddAliasedItem` to give a slate, then `(Slate.GetRef()).AddTextReplacementData("myName", messageForm)`, and the slate reads `<Token.Title=myName>`. No vanilla book uses `<Global=…>` or a `Token.Value` number, so whether book text can show a **live number is unverified**.
- `OnRead()` fires on the ref when the book is read (`ObjectReference.psc`, `Book_SanctumUniversum01_Script.psc`). There is no Papyrus call to *open* a book; the player reads it from the inventory. A terminal entry of type 5 opens a BOOK (xEdit).
- Verdict: a book can show fixed text plus names, and maybe tokens. It's a weaker progress screen than a terminal.

## The mod's own quest objectives

- Objective text (`NNAM`) takes `<Global=…>` (123 vanilla uses), `<Alias=…>` (437), and `.Name`, `.ShortName`, `.CurrentName`, `.PluralName`, pronouns. Examples: "Collect Genetags (`<Global=COM_SMQ01_GenetagsCollected>`/`<Global=COM_SMQ01_GenetagsTotal>`)", "Clear the `<Alias=TargetLocation>` on `<Alias=TargetPlanetLocation>`" (SF-verified).
- Live numbers: the global goes in the quest's `QTGL`, and the script calls `UpdateCurrentInstanceGlobal` after changing it, as `Quest.ModObjectiveGlobal` does (`Quest.psc`). Live place: a `LocationAlias` forced with `ForceLocationTo`, so "`<Alias=CurrentPlace>`: `<Global=HereDone>`/`<Global=HereTotal>` quests done" is possible.
- Quest names (`FULL`) take `<Alias=…>` too ("Bounty On `<Alias=Planet>`"). No vanilla quest name or log entry (`CNAM`) uses `<Global=…>`.
- Sizes: the longest vanilla objective is 146 chars (median 25), and the most objectives on one vanilla quest is 54 (`UC08`). Text can't change except through tags.
- Cost: re-showing an objective (`SetObjectiveDisplayed(…, abForce = true)`, which `ModObjectiveGlobal` does by default) pops it on the HUD. Whether the log text updates **without** a re-show (only `UpdateCurrentInstanceGlobal`) is **unverified**; it decides whether live objectives are quiet or noisy.
- Refreshing: vanilla scripts register for `BSMissionMenu` (the mission log) with `RegisterForMenuOpenCloseEvent` (6 scripts), and also for `DataMenu`, `GalaxyStarMapMenu`, `MonocleMenu`. So the tracker can refresh its globals the moment the player opens the log.

## Other things found on the way

- `ObjectReference.SetOverrideName(Message)` renames a ref after a Message's text (`FFConstantR02QuestScript`, on a relative). Message titles take tags (`<Alias.CurrentName=…>`, `<BaseName>`). Whether that could carry live text on an inventory item is unverified and probably a curiosity.
- `Game.ShowMissionBoardMenu(keyword)` opens the mission board, filtered by keyword. It's for board missions only, not a general list.
- `Debug.ExecuteConsole` exists in `Debug.psc`. It's console access, not a UI, and it is the sort of thing a Creation can't count on, so leave it out.

## What this means for the Creations edition

1. **Terminal = the "menu".** The build can generate one TMLM per system/planet/city (or one shared page filled by tokens), entries per quest with `GetQuestCompleted` / `GetStageDone` / `GetVMQuestVariable` conditions, and live counts through `AddTextReplacementValue` tokens. That's close to the Nexus menu's Locations view, minus icons and styling.
2. **Mission log = the HUD side.** One quest of our own, with objectives showing live counts for the current place.
3. **Message boxes = the no-world-object fallback,** and maybe the settings screen: up to 8 conditioned buttons and 9 numbers per box.
4. The open question that shapes #6 is **remote terminal opening**. Test it first in #5, together with: long-page scrolling, the `<Global>` owner lookup in terminals, `Token.Value` formatting, log refresh without a HUD pop, and Debug UI on consoles.
