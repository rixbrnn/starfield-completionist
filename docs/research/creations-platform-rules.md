# What Creations allow on Xbox, PS5 and PC

**Ticket:** [#2](https://github.com/rixbrnn/starfield-completionist/issues/2) (map [#1](https://github.com/rixbrnn/starfield-completionist/issues/1)).
**Status:** answered from documents, the live Creations catalog and the Creation Kit's own files (2026-10-16). Nothing here was tested on a console.

## Verdict: PS5 stays in scope

**PS5 can run a script-based Creation.** No Bethesda or Sony document says so in words. The evidence is what is live on PlayStation today and what the Creation Kit ships with:

- **Ship Vendor Framework** (rux616) is a free third-party Creation that is live on PlayStation, with about 1.2 million PlayStation plays. It was last updated on Sep 7, 2026. Its open-source repo ships Papyrus scripts, both its own (`SVF_Control.psc` and others) and overrides of four vanilla scripts. [catalog][svf-cat], [repo][svf-repo]
- The Creation Kit (1.16.244) lets the uploader target PC, Xbox and PlayStation, with one archive set per platform. Its PlayStation-specific warnings are about archives and audio, never scripts (see [Uploading](#who-can-upload-and-to-which-platforms)).
- The vanilla Papyrus sources only switch off debug functions on consoles. Nothing in them is limited to PS5 (see [Papyrus](#papyrus-scripts)).

Unlike Skyrim and Fallout 4 on PS4, PS5 also takes new assets: meshes, textures and interface SWFs (see [Assets](#new-assets)).

## Answers at a glance

| Question | Xbox Series X\|S | PS5 | PC (Steam / Game Pass) |
|---|---|---|---|
| Papyrus scripts | Yes | Yes (observed) | Yes |
| SFSE / script extenders | No | No | Nexus only, not Creations |
| New meshes and textures | Yes | Yes (observed) | Yes |
| New or replaced interface SWF | Yes | Yes, with a crash report for a heavy HUD (see below) | Yes |
| New sound files | Yes | CK warns they **won't play** in PlayStation archives | Yes |
| INI files | Blocked at upload | Blocked at upload | Blocked at upload |
| Max size of one Creation | 2 GB | 2 GB | 2 GB |
| Achievements with a free third-party Creation | Disabled | Disabled (trophies: unverified) | Disabled |

## Papyrus scripts

- Free Creations with Papyrus scripts run on Xbox, PS5 and PC. Ship Vendor Framework (above) is the clearest PS5 case. The Cheat Terminal (gir489), a port of Fallout 4's terminal-driven cheat mod, is another free Creation on all three platforms, with about 860,000 PlayStation plays. **Unverified:** its scripts were not inspected. [cheat-terminal]
- **Only vanilla native functions exist.** SFSE does not exist on console. Mods that need it stay on Nexus. (Secondary: [ResetEra thread][resetera], [howtovideogame].)
- **Debug functions do nothing on consoles.** The vanilla `Debug.psc` from the Creation Kit (`Tools/ContentResources.zip`) is declared `Native DebugOnly`. Its header comment says these functions do nothing in release console builds. That covers `Debug.Trace`/`TraceUser`, `Debug.Notification`, `Debug.MessageBox`, `ExecuteConsole` and the profiling calls. Many vanilla helpers are also marked `DebugOnly` or `BetaOnly`, so they are compiled out of release builds. **Consequence:** the Creations edition must not rely on `Debug.*` for anything the player sees. It should use `Message` forms instead. The Nexus edition's `Debug.TraceUser` logging will be silent on console. [game-sources]
- No official list of other restricted script functions was found. **Unverified:** whether any other native function behaves differently on PS5.

## New assets

- **Meshes and textures: yes on PS5.** *Starfield Hair+Beards* (zone79) is a free Creation of about 673 MB of new hair and beard meshes and textures. It is live on PlayStation (about 1.7 million plays), and its PlayStation build was updated on Apr 8, 2026, the day after the PS5 launch. [hair-cat]
- **Interface SWFs: yes on PS5, with a caveat.**
  - *Compact Mission UI* (Stentorious) is free and replaces `missionmenu.swf`. It is live on PlayStation (about 173,000 plays) and on Xbox and PC. [cmui-cat]
  - *StarUI - All-In-One* (inventory, HUD, workbench, ship builder and outpost menus) is live on Xbox and PlayStation (about 236,000 PlayStation plays). Its description says its settings appear under the game's Gameplay Options. [starui-cat]
  - Caveat: *Venworks Customizable HUD* replaces the HUD movies (`hudmenu.gfx` and others). It was built and uploaded with a separate PS5 archive, but crashed at startup on PS5. In its changelog, the author says they disabled PS5 until a rewrite. Its current listing shows Xbox and PC only. So a heavy custom Scaleform movie can be accepted for PS5 and still crash there. Test any interface file on PS5 hardware. (Secondary: mod author's [changelog][venworks-cl] and [catalog page][venworks-cat].)
- **Sound: a known PS5 gap.** When it builds console archives, the Creation Kit warns that audio files will not play on PlayStation. It also has PS5-specific Wwise settings (`bProcessAudioForPS5`, `sPathToSoundbankOutputPS5`, `sPathToVoiceOutputPS5`). **Unverified:** whether converted Wwise audio does play on PS5. [ck-binary]
- **Archives are per platform.** The Creation Kit builds separate archives for PC, Xbox and PlayStation. The Venworks build scripts name them `Main`, `Main_XBox` and `Main_PS`. The installation size shown can differ per platform: Ship Vendor Framework is 568 KB on PC and 473 KB on Xbox and PS. [ck-binary], [svf-cat]

## Plugin type, size and DLC masters

- **Type.** Starfield has full, medium (flag `0x400`, up to 65,535 records, sharing slot `FD`) and small/light (flag `0x100`, up to 4,095 records) plugins (secondary: [Ortham, LOOT author][ortham]). Bethesda's own Creations on disk are small or medium masters. Read from the TES4 headers in this PC install: `SFBGS004`, `SFBGS007`, `SFBGS008` and `SFBGS047` are small (`0x181`), `SFBGS003` (Trackers Alliance) and `SFBGS006` are medium (`0x481`), and `ShatteredSpace.esm` and `SFBGS050.esm` (Terran Armada) are full (`0x81`). `StarfieldCompletionist.esm` today is a full master (`0x01`). The Creation Kit's upload metadata records an `IsESLCompatible` field. No Creations rule requiring a given type was found. [ck-binary]
- **Size.** Since update 1.15.216 (May 22, 2025), a single Creation can be up to 2 GB. The Creation Kit stops oversized uploads with a "Mod Too Large" error. [patch-1.15.216], [ck-binary]
  - **Unverified:** the total console mod space for Starfield. Xbox is reported at 100 GB (secondary, 2024: [wccftech]); PS5 is unknown.
- **INI files are blocked.** The Creation Kit refuses INI files at upload ("does not support ini files"), and a 2024 hotfix stopped uploads of Creations with altered INI files (secondary: [pcgamesn]). Settings can't live in an INI.
- **DLC masters.** If a plugin lists `ShatteredSpace.esm` or `SFBGS050.esm` (Terran Armada, which itself masters `SFBGS00D.esm`) as a master, it needs that DLC. The Creations page then shows the DLC under **REQUIRED**. The community splits DLC fixes into separate Creations (Unofficial Shattered Space Patch, Unofficial Terran Armada Patch). [ussp-cat]
  - **To support the DLCs without requiring them:** don't make them masters. Look up their forms at runtime with vanilla `Game.IsPluginInstalled(name)` and `Game.GetFormFromFile(id, file)`, both declared in vanilla `Game.psc`. `QuestTracker.psc`/`MenuBridge.psc` already use `GetFormFromFile` with plugin names. [game-sources]
  - **Unverified on console:** that `GetFormFromFile` quietly returns None for a missing plugin.
- Gotcha (secondary): plugins whose filename ends in `ShatteredSpace.esm` vanished from the Creations Load Order screen as of 1.15.216 ([SVF changelog][svf-repo]). Avoid that suffix.

## Achievements

- Bethesda Support says Creations disable achievements unless they are tagged "Achievement Friendly". [bs-66046]
- Since update 1.14.74 (Nov 19, 2024), only Creations released through the **Verified Creator Program** can opt in to being achievement friendly. Bethesda's own Creations were already exempt. Achievements do not unlock retroactively on saves that already had Creations. Sources: the official @StarfieldGame post ([x-starfield], seen in search results, as X blocks fetching) and secondary coverage ([trueachievements], which quotes Bethesda on the no-retroactive point). The 1.14.74 notes on Bethesda.net don't repeat this line ([patch-1.14.74]).
- In the live catalog, every third-party "Achievement Friendly" listing is **paid** (100 to 400 credits). Each sits next to a free version that disables achievements: Hair+Beards (200), Enhance! Companions (100), Simple Immersive Looting (100), and others. Compact Mission UI points players to a separate achievement-friendly version, and StarUI says it plans no paid achievement-friendly version. [af-search]
- **So a free Creations edition will disable achievements** on Xbox and PC, and almost certainly PS5 trophies. **Unverified:** whether a Verified Creator can publish a *free* achievement-friendly Creation. None was found.

## Who can upload, and to which platforms

- **Anyone can release free Creations.** Only admitted Verified Creators can sell them. Verified Creators need, among other things, a Bethesda.net account linked to an Xbox account, MFA and a portfolio. Requirements for free uploads aren't stated beyond a Bethesda.net account and the Creation Kit. [vcp]
- **The Creation Kit is PC only, from Steam.** [ck-steam]
- **Platforms per upload.** The upload dialog targets **PC, XBox and PlayStation**. It warns when one of them has no archives ("You are submitting a Creation for PlayStation that has no archives") and errors with "no platforms selected" when none is chosen. Each platform gets its own build and update date: Hair+Beards' PlayStation build is dated Apr 8, 2026, its Xbox and PC builds Jul 31, 2025. Creators uploaded "PlayStation versions" after the PS5 launch (secondary: Elianora on X, Apr 2026, seen only in search results). [ck-binary], [hair-cat]
  - The upload metadata also has a `%sNintendo.json` variant. This is an observation only: no Nintendo Starfield release exists.
- **Outdated official text.** The Verified Creator FAQ's platform answer still lists Starfield Creations as PC (Microsoft Store and Steam) and Xbox Series X|S only, while the catalog shows PlayStation. Trust the catalog. [vcp]
- Bethesda's PS5 launch posts say Creations are included on PS5, but give no modding rules. [bnet-ps5-announce], [bnet-ps5-live]

## What this changes elsewhere

- **#3 (game's own interface):** a Creation may ship replacement Scaleform/SWF menus, and this works on PS5 (Compact Mission UI replaces `missionmenu.swf`). A Creation's settings can appear in the game's Gameplay Options (StarUI). Whether replacing a vanilla menu still counts as "the game's own interface" is the map's call. The risk is PS5 crashes with heavy movies, and conflicts with other menu replacers.
- **#4 (build and upload):** confirmed. Uploads are per platform from the Creation Kit, each with its own archives. Avoid sound files on PS5, and avoid INI files everywhere.
- **Map scope (achievements):** free means achievements are disabled, a real cost for completionist players. Being achievement friendly needs the Verified Creator route, which in practice means paid. That route is ruled out ("Out of scope").
- **Papyrus port:** replace `Debug.*` user feedback with `Message` forms. Keep DLC as soft dependencies through `GetFormFromFile`.

## Sources

Primary (Bethesda, Creations catalog, the Creation Kit's own files, mod authors' own repos for their own mods):

- [vcp]: Creations site, "Bethesda Game Studios Verified Creator Program" page and FAQ, https://creations.bethesda.net/en/creators/bethesdagamestudios (read 2026-10-16)
- [patch-1.15.216]: Bethesda.net, Starfield Update 1.15.216, https://bethesda.net/article/3eFYYUUqzOpOSv086XWMh9/starfield-update-notes-may
- [patch-1.16.236]: Bethesda.net, Starfield Update 1.16.236 (Free Lanes, Apr 7 2026), https://bethesda.net/article/5nPiSbxPOEGNSxz00DK4ms/starfield-free-lanes-update-notes (Creations fixes only; nothing on platforms)
- [patch-1.14.74]: Bethesda.net, Starfield Update 1.14.74, https://bethesda.net/en-US/news/starfield-update-1-14-74-november-19-2024
- [x-starfield]: @StarfieldGame on X, Nov 19 2024, https://x.com/StarfieldGame/status/1858930054572523833
- [bs-66046]: Bethesda Support, "Does using Creations disable achievements in Starfield?", https://help.bethesda.net/app/answers/detail/a_id/66046
- [bs-69345]: Bethesda Support, "Achievements are disabled" with Achievement Friendly Creations, https://help.bethesda.net/app/answers/detail/a_id/69345
- [bnet-ps5-announce]: https://bethesda.net/en/article/5EB9OYuO9DdP4lna0jkyMz/starfield-launches-on-playstation-5-on-april-7
- [bnet-ps5-live]: https://bethesda.net/en-US/news/starfield-is-available-now-on-playstation-5
- [ck-steam]: Starfield: Creation Kit on Steam, https://store.steampowered.com/app/2722710/Starfield_Creation_Kit/
- [ck-binary]: Starfield Creation Kit 1.16.244 (`CreationKit.exe`), UI and upload strings read locally: platform upload dialog, "Console Archives" audio warning, INI and size checks, `%sPC/XBox/PlayStation/Nintendo.json`, `IsESLCompatible`
- [game-sources]: vanilla Papyrus sources, `Tools/ContentResources.zip` → `Scripts/Source/Debug.psc`, `Game.psc` (`GetFormFromFile`, `IsPluginInstalled`)
- Plugin header flags: TES4 headers of the `.esm` files in a 1.16.244 PC install
- Creations catalog (creations.bethesda.net, read 2026-10-16; per-platform stats from each page's DETAILS tab):
  - [svf-cat] Ship Vendor Framework: https://creations.bethesda.net/en/starfield/details/36f1911d-8197-43f2-8a44-29a0c23209ec/Ship_Vendor_Framework__SVF_
  - [cheat-terminal] The Cheat Terminal: https://creations.bethesda.net/en/starfield/details/eeb649cd-d330-4a08-8bcf-ecf4f1116ba1/The_Cheat_Terminal
  - [hair-cat] Starfield Hair+Beards: https://creations.bethesda.net/en/starfield/details/84981815-7935-49d1-a9a7-9ed57f491105/Starfield_Hair_Beards
  - [cmui-cat] Compact Mission UI: https://creations.bethesda.net/en/starfield/details/51dab2d2-c610-4317-a6bf-144c92cb44b4/Compact_Mission_UI
  - [starui-cat] StarUI - All-In-One: https://creations.bethesda.net/en/starfield/details/d77c4c72-acf1-41bb-a21e-1fe5f4b92d26/StarUI___All_In_One
  - [venworks-cat] Venworks Customizable HUD: https://creations.bethesda.net/en/starfield/details/1d693691-1b23-48fe-9cc9-06be4fe63ad8/Venworks_Customizable_HUD___Venworks_Theme
  - [ussp-cat] Unofficial Shattered Space Patch: https://creations.bethesda.net/en/starfield/details/b752542d-e488-437d-8c99-a3e5a19cad64/Unofficial_Shattered_Space_Patch
  - [af-search] search "achievement friendly": https://creations.bethesda.net/en/starfield/all?text=achievement%20friendly
- [svf-repo]: https://github.com/rux616/starfield-ship-vendor-framework (`data/Scripts/Source/`, `CHANGELOG.md`)
- [venworks-cl]: https://github.com/monster-cookie/venworks-honkcore-ta-ui (`CHANGELOG.md` 2.0.5 to 2.0.19, `docs/BUILDSYSTEM.md`)

Secondary (community or press, used only where marked):

- [ortham]: Ortham (LOOT), "Load order in Starfield", https://blog.ortham.net/posts/2024-06-28-load-order-in-starfield/
- [trueachievements]: https://www.trueachievements.com/news/starfield-achievement-friendly-creations
- [pcgamesn]: https://www.pcgamesn.com/starfield/hotfixes-creations
- [wccftech]: https://wccftech.com/starfield-xbox-mod-limit-is-a-huge-upgrade-over-fallout-4/
- [resetera]: https://www.resetera.com/threads/starfield-ps5-free-lanes-update-and-terran-armada-dlc-ot-dont-call-it-starfield-2-0.1482976/page-12
- [howtovideogame]: https://howtovideogame.com/starfield-best-mods/

Not reachable: the Creation Kit wiki (creationkit.com/starfield) redirects to a wiki.bethesda.net maintenance page, and the Internet Archive was offline, so no CK wiki page could be cited.
