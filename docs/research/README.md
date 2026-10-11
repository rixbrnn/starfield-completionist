# Research spikes (Phase 0)

Each spike answers one question before we build on it. See PLAN.md §9.

| Spike | Question | Status | Notes |
|---|---|---|---|
| S1 | Which quests *stop* instead of *complete*? Do stage-done flags survive a stop? | open | needs in-game testing |
| S2 | Which QUST fields give the quest type? How do we filter out radiants and activities? | **mostly answered** | [S2-quest-types.md](S2-quest-types.md) |
| S3 | Location parent chain + keywords for system / planet / hub; player's current location | **offline half answered** | [S3-location-hierarchy.md](S3-location-hierarchy.md) |
| S4 | Prototype quest → place extraction on ~20 known quests | open | FLTR folder paths are a free hint (see S2) |
| S5 | New Game+: what resets, what carries over | **partly answered** | [S5-new-game-plus.md](S5-new-game-plus.md) |
| S6 | Do save/load messages carry the save name? | **answered: no messages at all** | SFSE 0.2.21 never dispatches messages 4–7 (Pre/PostSave, Pre/PostLoad), even though `PluginAPI.h` declares them; tested 2026-10-11. We need our own save/load hook or an event sink. Save files are named `Save13_DA62C98D_52696368617264_010133_<timestamp>_…sfs`: `DA62C98D` looks like a stable character ID and `52696368617264` is the character name in hex ("Richard"), which helps S5 and the NG+ lineage. |
| Runtime forms | Can the plugin reach quest records at runtime? | **answered** | Tested in game, 2026-10-11 (1.16.244): `TESForm::LookupByID` and `LookupByEditorID` work, and editor IDs are kept at runtime (MQ101 → `0x3448`, type `0x5B`). `TESDataHandler::formArrays` is **empty for all 215 types**, so CommonLibSF's layout is stale; don't use it. Quests come from our JSON (FormIDs) via `LookupByID`. Auto-discovering mod quests needs another enumeration method (later). |
| S7 | Does a DLL-only mod keep achievements enabled? | open | needs in-game testing |
| S8 | OSF UI: open a view from C++, push state, controller navigation | open | |
