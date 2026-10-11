# S5: New Game+ (Unity)

**Status:** partly answered (2026-10-11), from the game's Papyrus sources; not yet tested in game.

## What resets

Entering Unity starts a new universe. Quests reset, so the tracker (which reads quest state live) shows the new universe's progress. Script data on our quest may reset too; to be verified, including whether manual overrides survive.

## The New Game+ intro

In NG+ the intro runs as one of ten variants, `MQ401a`–`MQ401j` (all named "One Small Step"), not `MQ101`. They're tracked as hidden members of the equivalent group `one-small-step` (`data/curation.json`), so completing any of them completes the visible "One Small Step".

## What carries over: player actor values

Bethesda keeps NG+ facts in **actor values on the player**, moved to the new universe by `Actor.ApplyUnityCharacterData()` (native):

- `PlayerUnityTimesEntered`: how many times the player entered Unity (checked by MQ scripts: `GetValueInt(PlayerUnityTimesEntered) == 1` shows the NG+ tutorial)
- `MQ207_NGPlusCouncilAV`: a choice made in MQ207, set with `Game.GetPlayer().SetValue(...)`
- `AVTimesEnteredUnity`, `AVTimesMarried`

## Idea: lineage ("completed in any universe") without an extra file

Define our own actor values in `StarfieldCompletionist.esm` and give each quest a permanent bit. The tracker sets the bit on completion. A float holds integers exactly up to 2^24, so 24 bits per actor value: about 15 values for all entries. Bit assignments must be append-only so saves stay valid.

**Unverified:** whether mod-added actor values carry over like Bethesda's. Needs one real Unity jump.

## NG+-specific main missions (implemented 2026-10-11)

From `MQ401QuestScript` and the quest data:

- **Among the Stars** (`MQ402`): NG+ shortcut that skips the main story. Choice group `among-the-stars`: completing it locks out the skipped main missions ("Skipped by Among the Stars"); playing the story locks it out instead.
- **Foreknowledge** (`MQ404`): NG+ path that replaces Short Sighted, No Sudden Moves, High Price to Pay and Missed Beyond Measure. Choice group `foreknowledge`.
- Both are `ngPlusOnly`: not counted until `PlayerUnityTimesEntered` (Starfield.esm `0x219529`) is at least 1.
- From the 2nd Unity jump, `MQ401` may roll an alternate-universe variant (`MQ401a`-`j`), handled by the `one-small-step` equivalents.
