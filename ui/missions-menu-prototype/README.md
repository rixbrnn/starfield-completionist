# PROTOTYPE: Completionist in a replaced Missions menu

Throwaway code for the wayfinder ticket [How progress looks in a replaced Missions menu](https://github.com/rixbrnn/starfield-completionist/issues/5)
(map: [Completionist on consoles (Creations edition)](https://github.com/rixbrnn/starfield-completionist/issues/1)).
It lives on the `prototype/missions-menu` branch and is never merged. It tests the thin-hook design from
[How to build and maintain a replaced Missions menu](https://github.com/rixbrnn/starfield-completionist/issues/11)
on PC with SFSE turned off, as a stand-in for Xbox and PS5.

## What it is

| Piece | Where | What it does |
|---|---|---|
| Hook | `tools/build/build-missions-menu-prototype.ts` (`HOOK_EDITS`) | FFDec decompiles the vanilla `MissionMenu` class of `missionmenu.swf` and `missionmenu_lrg.swf`, the script inserts six small edits at text anchors, FFDec recompiles that one class. Adds a **COMPLETIONIST** category tab, loads our SWF, hides our feed quest from the vanilla list, passes input to our tab. No decompiled game code is committed. |
| Our SWF | `ui/missions-menu-prototype/as3/completionist/` | `CompletionistMissions.swf`, compiled by Flex `mxmlc` with the quest database generated into `QuestDatabase.as`. Draws the tab in three layouts and a diagnostics strip. |
| Feed | `ui/missions-menu-prototype/papyrus/CompletionistProto/Feed.psc` + generated `CompletionistProto.esm` | One quest whose objectives are text-display globals (`<Global=…>`). Papyrus packs the Nexus edition tracker's statuses (3 bits each, 8 per global), the player's location chain and each DLC plugin's load-order prefix into them, on load, location change and Missions menu open. |

## Build

Needs a `build/toolchain/` folder (or `--toolchain <dir>`) with:

- `jdk17/`: Eclipse Temurin 17 for Windows x64 (zip from adoptium.net)
- `ffdec/`: JPEXS FFDec 26.3.0 (`ffdec_26.3.0.zip` from its GitHub releases). Its `flashlib/playerglobal32_0.swc` also serves mxmlc, so Adobe's `playerglobal.swc` isn't needed.
- `flex/`: Apache Flex SDK 4.16.1 (`apache-flex-sdk-4.16.1-bin.zip` from archive.apache.org)

plus the Creation Kit (Papyrus compiler, Archive2) and `build/papyrus/Completionist/QuestData.psc` (made by `npm run build:mod` without `--install`; the script runs it if missing).

```bash
npm run prototype:missions-menu -- --toolchain C:/workspace/starfield_completionist/build/toolchain
```

Output: `build/missions-proto/CompletionistMissionsPrototype.zip` (`CompletionistProto.esm` + `CompletionistProto - Main.ba2`).

## Try it in game

1. Install the zip **through Vortex** (never copy into Data by hand; see the Vortex note in the project memory). Keep the Nexus edition (StarfieldCompletionist.esm) enabled: the feed reads its tracker.
2. Start Starfield **without SFSE** (Steam's normal launch, not `sfse_loader.exe`).
3. Load a save, open the Missions menu, go to the last tab, **COMPLETIONIST**.
4. Switch layouts with Set Course (XButton), `V`, or a click on the layout name. Toggle the diagnostics with Show on Map (YButton), `D`, or a click on them. Up/Down or the mouse wheel move through the list.
5. Check the other tabs still work, and repeat with large text mode on (Settings > Interface).

Remove it by disabling or uninstalling the mod in Vortex.
