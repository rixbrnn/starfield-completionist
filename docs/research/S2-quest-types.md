# S2: Quest types and the inclusion filter

**Status:** mostly answered (2026-10-11). Source: `npm run extract:quests` against Starfield 1.16.244 (Steam), all 13 official masters.

**Question:** which QUST fields tell us a quest's mission-log category, and how do we filter out radiants, activities and internal quests?

## Findings

1. **DNAM doesn't hold the type.** In plugin files DNAM is 12 bytes, and the byte where CommonLibSF's runtime `QUEST_DATA::questType` sits is 0 for every quest. The runtime value may be filled in from QTYP at load. The plugin's startup log (`questType` histogram) will tell us.

2. **QTYP is the category.** It references a keyword:

   | Keyword (EDID) | FormID | Category |
   |---|---|---|
   | `QuestTypeMainQuest` | `Starfield.esm\|0x0475FA` | main |
   | `QuestTypeFactions` | `Starfield.esm\|0x0475FD` | faction |
   | `QuestTypeSideQuest` | `Starfield.esm\|0x047600` | side (the in-game label is "Misc") |
   | `QuestTypeActivities` | `Starfield.esm\|0x0475F8` | activity |
   | `QuestTypeMission` | `Starfield.esm\|0x1E2D30` | mission board |

3. **FTYP is the faction.** It references a keyword:

   | Keyword (EDID) | FormID |
   |---|---|
   | `FactionTypeConstellation` | `Starfield.esm\|0x0546E1` |
   | `FactionTypeUnitedColonies` | `Starfield.esm\|0x0546DC` |
   | `FactionTypeFreestarCollective` | `Starfield.esm\|0x0546DF` |
   | `FactionTypeRyujinIndustries` | `Starfield.esm\|0x0546DD` |
   | `FactionTypeCrimsonFleet` | `Starfield.esm\|0x0546E0` |
   | `FactionTypeHouseVaruun` | `Starfield.esm\|0x0546DE` |
   | `FactionTypeTerranArmada` | `SFBGS050.esm\|0x09F0B4` |
   | `FactionTypeTrackersAlliance` | `SFBGS003.esm\|0x000EF5` |

   Both tables are encoded in `tools/extract/keywords.ts`.

4. **QMTY** is the mission-board job type (`MissionBoardTypeBounty`, `…Cargo`, `…Survey`, …). It only appears on radiant mission-board quests.

5. **FLTR** is the Creation Kit folder path, e.g. `\Main Quest\`, `\Settlement\AkilaCity\`, `\Settlement\Crucible\`, `\Settlement\HopeTown\`. It's set on only some quests, but it's a free location hint for S4.

6. **Plugin identities:**
   - `SFBGS003.esm` = Trackers Alliance
   - `SFBGS050.esm` = Terran Armada
   - `SFBGS00D.esm` = still to identify (adds 12 side quests and 1 main)

7. **FormID prefix.** Medium/small masters (e.g. `SFBGS003.esm`, header flags `0x481`) store their own records with a `0xFD` prefix in-file, not the master index. `formKey()` handles this.

## Counts

Named quests with at least one objective (2,594 QUST records in total, 1,553 named):

| Category | Starfield | SFBGS00D | SFBGS050 (Terran Armada) | SFBGS003 (Trackers) | ShatteredSpace |
|---|---:|---:|---:|---:|---:|
| main | 31 | 1 | 1 | 0 | 0 |
| faction | 47 | 0 | 7 | 2 | 8 |
| side | 115 | 12 | 8 | 5 | 11 |
| activity | 125 | 3 | 7 | 0 | 3 |
| mission | 112 | 0 | 8 | 4 | 9 |
| (untagged) | 39 | 7 | 1 | 0 | 2 |

## Draft inclusion rule

- **Include:** QTYP = main, faction, side; named; at least one objective.
- **Review by hand:** untagged quests with objectives (49). Real quests are among them: companion quests such as Barrett's "Worlds Apart", Akila City's "Rough Landings", Crucible's "Secret Lives". They're mixed with overlay/space encounters (`OE_*`, `SE_*`), debug and `_OLD` quests.
- **Exclude:**
  - QTYP = mission (mission-board radiants)
  - names containing `<Alias=…>` (templated radiants)
  - bracketed internal names (`[…]`)
- **Decide later:** QTYP = activity (148). Some may be one-off and worth an optional category in v1.1.

That gives roughly **300 candidate quests** before curation.

## Still open

- How are companion quests identified? (`COM_` editor-ID prefix, `FollowersSupport\…` folder?)
- What is `SFBGS00D.esm`?
- Does the runtime `questType` match QTYP? (Check the plugin log.)
- Which DNAM bits are flags we care about (e.g. "start game enabled")?
