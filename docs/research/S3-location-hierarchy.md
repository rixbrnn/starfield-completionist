# S3: Location hierarchy

**Status:** offline half answered (2026-10-11); the runtime half (player's current location) is still open. Source: a probe over the LCTN records in `Starfield.esm` (6,017 locations).

**Question:** can we classify locations into star system / planet / hub and walk from any location up to its system?

## Findings

LCTN records chain through **PNAM (parent location)**, and each level carries **`LocType*` keywords**:

```
Neon            [CityNeonLocation]               LocTypeSettlement
 └ Volii Alpha  [SVolii_PVoliiAlpha_Surface]     LocTypeSurface
   └ Volii Alpha [SVolii_PVoliiAlpha]            LocTypePlanet, LocTypeSettledPlanet, LocTypeMajorOrbital
     └ Volii    [SVolii]                         LocTypeStarSystem, LocTypeSettledSystem
       └ Universe
```

The same pattern holds for:

| Hub | Planet | System |
|---|---|---|
| New Atlantis | Jemison | Alpha Centauri |
| Akila City | Akila | Cheyenne |
| Cydonia | Mars | Sol |

Stations hang off an **orbit** node instead of a surface: *The Key* → `SKryx_PSuvorov_Orbit` (`LocTypeOrbit`) → Suvorov → Kryx.

Classification rule (draft):

| Level | How to recognize it |
|---|---|
| System | `LocTypeStarSystem` |
| Planet / moon | `LocTypePlanet` (check whether moons use a different keyword) |
| Surface / orbit | `LocTypeSurface` / `LocTypeOrbit`. Skip these when grouping; they only connect hub to planet |
| Hub | First ancestor (or self) below the surface/orbit level, e.g. `LocTypeSettlement`, stations |

Editor IDs follow `S<System>_P<Planet>[_Surface|_Orbit]`, which is a handy cross-check.

## Still open

- Moons: keyword and naming.
- Hubs with no keyword (e.g. *The Key* has none); use "child of a surface/orbit node" as the rule.
- Locations in DLC masters (Shattered Space's Va'ruun'kai, Terran Armada).
- Runtime: read the player's current location and walk the same chain in C++ (CommonLibSF `BGSLocation`).
- Next: turn the probe into `tools/extract/dump-locations.ts` and link quests to places (S4).
