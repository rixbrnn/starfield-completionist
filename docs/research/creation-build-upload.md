# How a Creation is built and uploaded

**Question** ([#4](https://github.com/rixbrnn/starfield-completionist/issues/4)): how is a Creation built and uploaded, and can the Creations edition be built by this repo's own tools (`tools/build/build-mod.ts` generates the ESM and compiles the Papyrus)?

**Status:** answered from primary sources, 2026-10-16. The upload of an externally generated ESM has not been tried; see "Open: test before deciding".

## Short answer

- **The build can stay ours; the upload can't.** Generating the ESM and the quest table runs anywhere. Compiling Papyrus and packing the BA2 archive need Windows plus the Creation Kit's tools (`PapyrusCompiler.exe`, `Archive2.exe`), but both are command-line tools a script can run. Uploading only happens in the Creation Kit's GUI, by hand, logged into Bethesda.net. The Creation Kit has no command-line upload.
- **Upload flow:** the Creation Kit's `File > Upload Plugin and Archive to Bethesda.net`. You log in (a first sign-in on a device needs an emailed code), and the Bethesda.net account must be linked to the Steam account that owns Starfield. You create a Creation or edit an existing one (title, description, up to 5 categories, platforms), and the Creation Kit packages the ESM plus its BA2 archives and uploads them. PC, Xbox and PlayStation are separate targets in the same dialog.
- **Archives:** the files go in BA2s named after the plugin (`<Plugin> - Main.ba2`, `<Plugin> - Textures.ba2`). The Creation Kit's `File > Create Archive` is a front end for `Archive2.exe`, so our build can call `Archive2.exe` itself, or generate the `.achlist` file list the dialog imports.
- **Externally generated ESM:** probably uploadable as is. With no active plugin, the upload dialog asks you to "pick an ESM to package and upload instead". When a plugin is active, it must be saved first, and the dialog exports it to an ESM. **Unverified** until we try it with `StarfieldCompletionist.esm`.
- **Review:** a Creation goes through review states: *Unpublished*, *In review*, *Published*, *Published, update pending*, *Rejected*, *Resubmit*. Something in review or rejected can't be updated. An update goes up through the same dialog ("Edit Creation"), replacing the files. Who reviews free Creations and how long it takes is **unverified**.

## Sources and trust

- **Primary, the tool itself:** UI strings in `CreationKit.exe` 1.16.244.0 (Steam, installed with the game, file dated 2026-10-11), pulled with a strings dump. They are the Creation Kit's own dialog text, menu items and command-line switches. They show what exists, not the exact order of the steps. Line refs below are to that dump; to reproduce it, extract printable ASCII/UTF-16 runs from the exe.
- **Primary, Bethesda:** Starfield patch notes and announcements on Steam (fetched with `ISteamNews/GetNewsForApp`, appid 1716740), Bethesda's support article on modding guidelines, and `Archive2.exe -?` (Creation Kit tools, v1.2.0.1).
- **Not available:** Bethesda's Creation Kit wiki (`creationkit.com/starfield`) redirects to `wiki.bethesda.net/Main/Maintenance/` today. The new XWiki has no Starfield space yet (checked through its REST API), and the Wayback Machine has no copy of the page. So there was no official step-by-step guide to read.
- **Secondary, labelled as such:** the Starfield Wiki (UESP, `starfieldwiki.net`), Nexus Mods forum threads, and a creator's post on X.

## 1. The upload flow (Creation Kit)

From the Creation Kit's strings (primary):

| What | Evidence |
|---|---|
| Menu items `Create Archive`, `Upload Plugin and Archive to Bethesda.net`, `Login to Bethesda.net` | dump l. 33892-33894 |
| Upload actions per platform: `actionUpload_Plugin_PC`, `actionUpload_Plugin_XB1`, `actionUpload_Plugin_PS4` (legacy names). INI `bEnableXB1:Bethesda.net`, `bEnablePS4:Bethesda.net`. Platform labels `XboxCreation`, `PS5Creation` | l. 33475-33477, 36392-36394, 39737-39738 |
| "Your Bethesda.net account must be linked to your Starfield Steam account in order to upload mods to Bethesda.net." plus a `Link My Account` link to `https://bethesda.net/account/linked-accounts` | l. 38303, 37356-37357 |
| Login dialogs: `Bethesda.net Login`, `Create Account`, "This appears to be your first sign in using this device. A security code has been emailed to you…", `Bethesda.net Legal Documents` | l. 213720-213726 |
| The Creation dialog: `Bethesda.net Creations Admin`, `Create New Creation`, `Edit Creation`, `Bethesda.net Mod Upload`, `Characters remaining`, `Language`. The rules are "You must select at least 1 category" and "You may only select up to 5 categories". Errors include "The title is either taken or not available." and "The title or description contains forbidden language." | l. 213731-213740, 37347-37348, 38322-38323 |
| The package step: "You are submitting a Creation for PC / XBox / PlayStation that has no archives. Continue?", "Error: no platforms selected", and per-platform detail files `%sPC.json`, `%sXBox.json`, `%sPlayStation.json` (fields include `IsESLCompatible`, `Dependencies`, `BSAFiles`, `fileSize`) | l. 61351-61356, 61371-61378 |
| Limits: "Total mod size of %ull MB is too large, must be under %ull MB." and "%s does not support ini files." The patch notes for 1.15.216 (May 2025) say "Creations up to 2GB in size can now be uploaded." | l. 38578-38583; [Steam patch notes 1.15.216](https://store.steampowered.com/news/app/1716740/view/1798454487767416) |
| On completion: "Creation Upload Complete", "Creation Content ID: %s", "Click here to open the Creation on Bethesda.net." | l. 38312-38314 |

Other facts (primary, Bethesda):
- The Creation Kit is a separate, Steam-only download: "this is a separate download from the game download and is only available on Steam" ([Update 1.12.30 notes, 2024-06-09](https://store.steampowered.com/news/app/1716740/view/5746109972561139047)). It runs on Windows only.
- "Anyone in the community can make Creations and upload them to the Creations platform" (same announcement). Selling one needs the Verified Creator program, which is out of scope since ours is free.

**Per-platform uploads:** the dialog takes a platform selection, and each platform has its own archive check and detail file. From the strings alone it's **unverified** whether one Creation (one content ID) holds the PC, Xbox and PlayStation builds, or each platform is its own upload. It's also unverified whether the files can be shared across platforms or must be built per platform. Secondary: on 2026-04-07 a known creator posted that she had "uploaded PlayStation versions of all my Starfield mods" ([X post](https://x.com/Elianora/status/2041574480703619204)), so PlayStation is a separate upload step at least.

## 2. Archives (BA2): who builds them

- **The Creation Kit builds them through Archive2.** Its `Create Archive` runs `%sArchive2.exe -create="%s" -sourceFile="%s" -format="%s" %s`, with a temporary `TempArchiveFileList.txt` and `-compression=None` or `-compression=Default` (dump l. 37958-37964). The dialog has a `Console Archives` option and "Save main archive as / Save textures archive as" (l. 37990-37993). It rejects files outside `Data\` ("all archived files must be in "Data\" or one of its subdirectories", l. 37974).
- **Names:** `" - Main.ba2"`, `" - Textures.ba2"` and the pattern `.* - Main[0-9]*\.ba2` (l. 36102, 36435-36436, 38041). An archive is tied to its plugin by name, as in the base game's `Starfield - *.ba2`.
- **File lists:** the dialog imports and exports an `Archive File List (*.achlist)`, which must be a JSON array of strings ("Import file list is malformed - expected JSON array", l. 37976-37985). Our build could write `StarfieldCompletionist.achlist` with the `.pex` paths, which would avoid picking files by hand.
- **Archive2 has a full command line** (`Archive2.exe -?`, Creation Kit tools v1.2.0.1): `-create`, `-sourceFile`, `-root`, `-format=<General|DDS|XBoxDDS>`, `-compression=<None|Default|XBox|LZ4>`, `-quiet`, and more. It's a .NET Windows program (`Archive2.exe.config`, `Archive2Interop.dll`). So `build-mod.ts` can pack the BA2 on Windows the way it already runs `PapyrusCompiler.exe`.
- **Xbox:** Xbox *textures* need the `XBoxDDS` format and the Creation Kit "cannot automatically archive" them; the Xbox archive suffixes are `- Main_Xbox` and `- Textures_Xbox` (secondary: [Starfield Wiki, Archive2](https://starfieldwiki.net/wiki/Starfield_Mod:Archive2), [Archiving Textures for Xbox](https://starfieldwiki.net/wiki/Starfield_Mod:Archiving_Textures_with_Archive_2_for_Xbox_and_Game_Pass)). We have no textures. **Unverified:** whether a scripts-only Xbox upload needs its own `- Main_Xbox.ba2` (for example with `-compression=XBox`), or takes the PC `- Main.ba2`. The suffix doesn't appear as a literal in `CreationKit.exe`.
- **PlayStation:** the Creation Kit warns "On PlayStation, audio files will not play. Continue archiving?" (l. 37991) and offers "submitting a Creation for PlayStation that has no archives". That implies PlayStation uploads can carry archives (we have no audio). When the target platform takes no archives at all, it says "%s does not support archives… Do you still want to upload your plugin only?" (l. 38574-38576). **Unverified** which platform that applies to today. Platform rules belong to the platform-rules ticket.
- **Loose files:** the package is the ESM plus its named BA2s; the Creation Kit counts other files as "detected external files". So the Creations edition's `.pex` scripts must go **in a BA2**, not loose as in the Nexus zip. This is inferred from the strings, as with every earlier Bethesda.net upload; **not tested**.
- **Writing BA2s in TypeScript** (no Archive2) is possible from the community-documented format, but whether Bethesda's pipeline accepts an archive Archive2 didn't make is **unverified**. Using Archive2 is the safe choice.

## 3. Can an externally generated plugin and compiled scripts go through as is?

What the Creation Kit says (primary):
- "No active plugin - select an active plugin or save before uploading" and, in a separate dialog, `Pick ESM`: "No active plugin - pick an ESM to package and upload instead:" (l. 38589, 213747-213748). So the upload can start from an ESM file on disk that isn't open as the active plugin.
- With an active plugin: "There are altered forms that need to be saved before you can upload your plugin." The package step writes an ESM ("An ESM with name '%s' already exists… Do you wish to overwrite this file?", "Overwriting currently loaded files is prohibited.", l. 61357-61360, in `TESCreationPackageDialog`). So the usual path is: the Creation Kit exports the active plugin to an ESM during upload.
- Master types: `Small Master`, `Medium Master`, `Full Master` and `Convert the active file to a %1Master file?` (l. 33845-33847, 34209-34211, 36187). The package details record `IsESLCompatible`.

What that means for us:
- `build-mod.ts` writes a TES4 header with HEDR 0.96, flags `0x1` (a full master), master `Starfield.esm`, one QUST with a VMAD (`tools/esm/writer.ts`). The `Pick ESM` path suggests this file can be packaged without a Creation Kit save. **Unverified:** whether the Creation Kit loads or validates the picked ESM while packaging (it computes `IsESLCompatible`, dependencies and sizes, so it probably parses it), and whether it accepts a file it didn't write.
- Secondary: plugins from other tools (xEdit) can trip the Creation Kit. For example, xEdit adds a master `BlueprintShips-Starfield.esm` that makes the Creation Kit hang; the Plugin Bridge tool says its output must be "loaded and saved in Creation Kit… or xEdit" ([Starfield Plugin Bridge](https://www.nexusmods.com/starfield/mods/10189)). Our writer adds only `Starfield.esm`.
- Secondary: "You should never change [the master type] once your mod has been published" ([Nexus forum](https://forums.nexusmods.com/topic/13490670-how-to-export-mods-from-creation-kit-to-upload-on-nexus-mods/)), since form IDs and the slot change. So the Creations edition's master type (small, medium or full) must be chosen **before the first upload**. Today's ESM is a full master and takes a full load-order slot for one record.
- **Compiled scripts:** the `.pex` come from Bethesda's own `PapyrusCompiler.exe` (in the Creation Kit's tools), the same compiler the Creation Kit runs. So nothing about the scripts needs the editor. They only need to be in the BA2. Note that `QuestData.pex` is called as a global script and isn't attached to any form. If the Creation Kit fills archives from what the plugin references, it would miss that file, so list it explicitly (`.achlist`). **Unverified** whether the Creation Kit auto-collects anything.

## 4. Review, approval and updates

- Statuses in the Creation Kit's Creations list: `UNPUBLISHED`, `PUBLISHED`, `PUBLISHED, UPDATE PENDING`, `IN REVIEW`, `REJECTED`, `RESUBMIT`, with columns `Content ID`, `Review Status`, `Platforms` (dump l. 37322-37334). Also "Creations in review cannot be updated." and "Rejected creations cannot be updated." (l. 37338-37339), and the status step `UpdateModContentStatusToBinaryPending` (l. 38311).
- **Updates:** you push one by opening the Creation in `Edit Creation`, uploading new files ("Warning: User content already exists and will be overwritten.", l. 37350), and adding release notes (`== Describe this release ==`, l. 61350). The status then shows *Published, update pending* until it goes live. Players get updates through the in-game Creations menu (Bethesda tells players to "keep an eye on the Creations menu", [November 2024 update post](https://store.steampowered.com/news/app/1716740/view/1783872411961900)).
- **Content rules:** Bethesda's modding guidelines list what gets removed (NSFW, third-party or other-game assets, getting around paid add-ons) and ask for box art, screenshots or a description ([Bethesda Support, Modding Guidelines - Mods/Creations](https://help.bethesda.net/app/answers/detail/a_id/51731/~/bethesda.net-modding-guidelines---mods/creations)). They don't describe a review before publishing.
- **Unverified:** whether every free Creation goes through *In review* before players can see it, or only some (for example console builds or updates), and how long that takes. No official source states it.
- Side finding (primary): only Creations "released through the Verified Creators program" can be achievement friendly ([November 2024 update post](https://store.steampowered.com/news/app/1716740/view/1783872411961900)). A free community Creation like ours **blocks achievements**. This matters to the platform-rules ticket and the Creations page text.

## 5. What needs Windows and the Creation Kit by hand

| Step | Where it can run |
|---|---|
| Quest table `QuestData.psc` and `StarfieldCompletionist.esm` (TypeScript) | Anywhere, CI included |
| Compile Papyrus (`PapyrusCompiler.exe`) | Windows with the Creation Kit installed (it ships only with the Creation Kit on Steam; the base `.psc` sources come from its `ContentResources.zip`). Scriptable, as `build-mod.ts` does today |
| Pack the BA2 (`Archive2.exe`) | Windows with the Creation Kit installed. Scriptable from the command line |
| Log in, link accounts, create or edit the Creation, pick platforms, upload, add release notes | **By hand in the Creation Kit GUI.** It has no command-line upload: its switches cover exports, icons and validation, but nothing uploads (dump l. 37994-38037, 38275-38283). Login takes an emailed code on a new device. Bethesda's upload API (`/ugcmods/v2/upload/…`) is private and shouldn't be scripted |

A CI runner can't do the last three: the tools aren't redistributable and come from a Steam install with Starfield owned, and the upload needs a person. So a Creations release is: run the build on the maintainer's Windows PC, then upload by hand in the Creation Kit for each platform.

## Open: test before deciding

1. In the Creation Kit (`File > Data`, `Starfield.esm` only, no active file), run `Upload Plugin and Archive to Bethesda.net` and check that `Pick ESM` takes `build/mod/StarfieldCompletionist.esm` with a `StarfieldCompletionist - Main.ba2` made by `Archive2.exe`. Stop before publishing, or leave it *Unpublished*.
2. Find out whether the Xbox and PlayStation targets need their own archives (`- Main_Xbox.ba2`, `-compression=XBox`) for a scripts-only Creation.
3. Find out whether a free Creation always passes *In review* before players see it, and how long that takes.
4. Pick the master type (small, medium or full) before the first upload.
