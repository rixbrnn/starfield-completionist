# Contributing to Completionist

Thanks for helping! The most useful contributions are **quest data fixes**, and they need no coding.

## Reporting a problem

[Open an issue](https://github.com/rixbrnn/starfield-completionist/issues/new/choose):

- **Quest tracked wrongly:** wrong status, wrong place, wrong questline order, missing or shouldn't be listed.
- **Bug:** the menu doesn't open, a feature doesn't work, controller problems.

The Completionist log helps a lot: `Documents/My Games/Starfield/Logs/Script/User/Completionist.0.log`. It needs `bEnableLogging=1` under `[Papyrus]` in `StarfieldCustom.ini`.

## Fixing quest data

Most quest data is generated from the game files, then corrected by hand in two places:

| Fix | Where |
|---|---|
| Story order of a questline | `data/curation.json` → `questlineOrder` |
| Branching choices (one path locks out another) | `data/curation.json` → `choiceGroups` |
| New Game+ only quests, variants of the same quest | `data/curation.json` → `ngPlusOnly`, `equivalents` |
| Duplicate records to drop, renamed quests | `data/curation.json` → `exclude`, `names` |
| Start place of a quest | `data/quests/*.json` → the quest's `start.place` |

Quests are referred to by their editor ID (e.g. `RI01`); the `editorId` field in `data/quests/*.json` shows it next to each name.

Check your change before opening a pull request:

```bash
npm install
npm run validate
```

## Building

You need Node.js 24+, a Steam install of Starfield, and the Starfield Creation Kit (for the Papyrus compiler). See the [README](README.md):

- `npm run extract:quests` reads the game data.
- `npm run build:drafts` regenerates `data/quests/*.json` with the curation applied.
- `npm run build:mod -- --install` compiles and installs into your game.
- `npm run preview:menu` shows the menu in a browser with sample progress.

## Pull requests

- Keep each pull request to one fix or feature.
- Never commit Bethesda files (the extracted base scripts in `build/` are git-ignored for this reason).
- By contributing you agree your work is licensed under GPL-3.0-or-later, like the rest of the project.
