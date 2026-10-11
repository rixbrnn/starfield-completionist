# Publishing on Nexus Mods

## Build the release

Run these with the Creation Kit installed:

```powershell
npm run build:mod
npm run package
```

Output: `dist/StarfieldCompletionist-<version>.zip`. Its contents mirror the game's `Data` folder:

- `StarfieldCompletionist.esm`
- `Scripts/Completionist/*.pex`
- `Scripts/Source/Completionist/*.psc` (sources, with `LICENSE.txt` and `EXCEPTIONS.txt`)
- `SFSE/Plugins/OSF/UI/views/completionist/menu/` (the menu)
- `SFSE/Plugins/OSF/Settings/schemas/completionist.json` (the F7 hotkey)

The C++ SFSE plugin (`plugin/`) is **not** part of the release; the mod doesn't use it.

The version comes from `package.json`; bump it before packaging.

## Create the mod page (first release)

1. nexusmods.com → Starfield → **Upload a mod**.
2. **Name** and **summary** (one line, e.g. "Every quest and activity in Starfield, and what you're still missing in each system, planet and city.").
3. **Description:** paste `docs/nexus/description.bbcode`.
4. **Category:** Utilities (or User Interface). **Tags:** Quests, User Interface, Quality of Life.
5. **Requirements:** add SFSE (106), Address Library for SFSE Plugins (3256), OSF Settings (18326), OSF UI (17711).
6. **Permissions:** the code is GPL-3.0-or-later; credit the inspiration (Faen90's Completionist).
7. **Images:** in-game screenshots of the menu (Log, Here, Locations, Quests tabs) at 1080p or higher.
8. **Files:** upload the zip as a Main file, with the version and a changelog. Leave the "Mod manager download" option on.
9. Publish (or keep hidden while testing with friends: Nexus lets you upload while the page is unpublished).

## Updates

1. Bump `version` in `package.json`.
2. `npm run build:mod && npm run package`.
3. On the mod page: Files → upload the new zip, then archive the previous one or keep it as an old version. Add a changelog entry.
