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
- `SFSE/Plugins/OSF/Settings/schemas/completionist.json` (the Open hotkey and the wheel diagnostics toggle)

The C++ SFSE plugin (`plugin/`) is **not** part of the release; the mod doesn't use it.

The version comes from `package.json`; bump it before packaging.

## Create the mod page (first release)

1. nexusmods.com → Starfield → **Upload a mod**.
2. **Name** and **summary** (one line, e.g. "Every quest and activity in Starfield, and what you're still missing in each system, planet and city.").
3. **Description:** paste `docs/nexus/description.bbcode`.
4. **Category:** Utilities (or User Interface). **Tags:** Quests, User Interface, Quality of Life.
5. **Requirements:** add SFSE (106), OSF Settings (18326), OSF UI (17711).
6. **Permissions:** the code is GPL-3.0-or-later; credit the inspiration (Faen90's Completionist).
7. **Images:** `npm run build:mod` then `npm run media` writes the header banner (1300x372) and 1920x1080 gallery shots of the menu to `dist/nexus-media/` (preview showcase mode; they contain the game's icons, so they are not committed). Add in-game screenshots too if you can.
8. **Files:** upload the zip as a Main file, with the version and a changelog. Leave the "Mod manager download" option on.
9. Publish (or keep hidden while testing with friends: Nexus lets you upload while the page is unpublished).

## Updates

1. Bump `version` in `package.json`.
2. `npm run build:mod && npm run package`.
3. On the mod page, **Files** → upload the new zip as a **Main file**. Set its **version** to exactly the `package.json` version (`1.0.5`, never `1.0` or blank), and add a changelog entry.
4. Move **every** previous main file to **Old versions** (or **Archived**), so only the new one is a main file. Vortex and MO2 look for updates through the file's version and these file categories: leaving old files as main files is the likely reason 1.0.0 installs were never offered an update (Nexus comments, Oct 2026).
5. Set the mod page **version** (Edit mod → Details) to the same version.
6. If the description changed, paste `docs/nexus/description.bbcode` again, and check that the **Requirements** section still lists the mods from step 5 of the first release.
7. Check: from an older install, Vortex's "Check for updates" offers the new version.
