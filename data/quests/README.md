# Quest collections

Curated quest data the plugin loads at runtime. There's one file per source: `vanilla.json`, `shattered-space.json`, `terran-armada.json`, `trackers-alliance.json`, and later packs for other mods.

Each file follows [`../schema/quests.schema.json`](../schema/quests.schema.json); see [`../schema/example.quests.json`](../schema/example.quests.json). Run `npm run validate` before committing.

Drafts come from `npm run extract:quests` (Phase 2) and are then curated by hand. Never copy text from wikis into hints; write them yourself.
