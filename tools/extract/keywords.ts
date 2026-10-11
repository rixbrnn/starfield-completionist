// Keywords that QUST records reference, decoded in spike S2 (docs/research/S2-quest-types.md).

/** QTYP → mission log category. */
export const QUEST_TYPES: Record<string, string> = {
  "Starfield.esm|0x0475FA": "main", // QuestTypeMainQuest "Constellation"
  "Starfield.esm|0x0475FD": "faction", // QuestTypeFactions
  "Starfield.esm|0x047600": "side", // QuestTypeSideQuest "Misc"
  "Starfield.esm|0x0475F8": "activity", // QuestTypeActivities
  "Starfield.esm|0x1E2D30": "mission", // QuestTypeMission (mission board)
};

/** FTYP → faction the quest belongs to. */
export const FACTION_TYPES: Record<string, string> = {
  "Starfield.esm|0x0546E1": "constellation",
  "Starfield.esm|0x0546DC": "united-colonies",
  "Starfield.esm|0x0546DF": "freestar-collective",
  "Starfield.esm|0x0546DD": "ryujin-industries",
  "Starfield.esm|0x0546E0": "crimson-fleet",
  "Starfield.esm|0x0546DE": "house-varuun",
  "SFBGS050.esm|0x09F0B4": "terran-armada",
  "SFBGS003.esm|0x000EF5": "trackers-alliance",
};
