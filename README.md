# Starfield Completionist

*Working title.* An SFSE plugin that tracks every quest in Starfield and shows what you're still missing in each star system, planet and city. It's inspired by Faen90's [Completionist](https://www.nexusmods.com/skyrimspecialedition/mods/46358) for Skyrim.

**Status:** Phase 0 (setup and research). Nothing to install yet. See [PLAN.md](PLAN.md) for the full plan and [docs/research](docs/research/README.md) for findings so far.

## Repository layout

| Path | What |
|---|---|
| `plugin/src/` | C++ SFSE plugin (built with [CommonLibSF](https://github.com/libxse/commonlibsf), included as a submodule in `lib/`) |
| `xmake.lua` | Plugin build |
| `data/schema/` | JSON Schema for quest collections, plus an example |
| `data/quests/` | Curated quest collections (coming in Phase 2) |
| `tools/esm/` | Reader for Starfield plugin files, BA2 archives and string tables |
| `tools/extract/` | Scripts that extract quest data from the game files |
| `tools/validate/` | Checks quest collections (run in CI) |
| `docs/research/` | Notes from Phase 0 research spikes |

## Building the plugin

Every push builds the DLL on GitHub Actions; download it from the run's **Artifacts**.

To build locally you need:

- Visual Studio 2022 or later with the "Desktop development with C++" workload
- [XMake](https://xmake.io) 3.0+

Then:

```bash
git clone --recurse-submodules https://github.com/rixbrnn/starfield-completionist.git
xmake config --mode=releasedbg
xmake build
```

Set `XSE_SF_MODS_PATH` (your MO2 `mods` folder) or `XSE_SF_GAME_PATH` (the Starfield folder) and the build installs the DLL there.

The plugin needs [SFSE](https://sfse.silverlock.org/) and [Address Library for SFSE Plugins](https://www.nexusmods.com/starfield/mods/3256). For now it only writes research logs to `Documents/My Games/Starfield/SFSE/Logs/StarfieldCompletionist.log`.

## Data tools

Needs Node.js 24+ (it runs the TypeScript directly) and a Steam install of Starfield.

```bash
npm install
npm run extract:quests
```

The first command installs the tools' dependencies. The second dumps every quest record to `build/extract/quests.json`.

Other commands:

- `npm run find-forms -- --from-dump QTYP` resolves the keywords that quests reference.
- `npm run validate` checks quest collections against the schema.
- `npm run typecheck` type-checks the tools.

The game path is found automatically for default Steam installs; otherwise pass `--game <path>` or set `STARFIELD_PATH`.

## License

[GPL-3.0-or-later](LICENSE) with the modding and linking exceptions in [EXCEPTIONS](EXCEPTIONS), the same terms as CommonLibSF.
