# Research spikes (Phase 0)

Each spike answers one question before we build on it. See PLAN.md §9.

| Spike | Question | Status | Notes |
|---|---|---|---|
| S1 | Which quests *stop* instead of *complete*? Do stage-done flags survive a stop? | open | needs in-game testing |
| S2 | Which QUST fields give the quest type? How do we filter out radiants and activities? | **mostly answered** | [S2-quest-types.md](S2-quest-types.md) |
| S3 | Location parent chain + keywords for system / planet / hub; player's current location | open | next: dump LCTN records |
| S4 | Prototype quest → place extraction on ~20 known quests | open | FLTR folder paths are a free hint (see S2) |
| S5 | CommonLibSF events for quest stage/status and location change | open | |
| S6 | Do save/load messages carry the save name? | **probe ready** | plugin logs the payload of SFSE messages 4–7 |
| S7 | Does a DLL-only mod keep achievements enabled? | open | needs in-game testing |
| S8 | OSF UI: open a view from C++, push state, controller navigation | open | |
