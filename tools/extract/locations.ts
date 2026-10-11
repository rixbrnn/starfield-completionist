// Location tree (LCTN records): parent chain and system / planet / hub classification.
// See docs/research/S3-location-hierarchy.md.

import { zstring } from "../esm/io.ts";
import { forEachRecord, formKey, type PluginHeader } from "../esm/plugin.ts";
import { readLString, type StringTable } from "../esm/strings.ts";

export interface LocationInfo {
  key: string;
  editorId: string;
  name: string;
  parent?: string;
  /** LocType* keywords only. */
  types: string[];
}

export interface ResolvedPlace {
  system?: LocationInfo;
  planet?: LocationInfo;
  /** City, settlement, station or other place directly under a planet's surface/orbit. */
  hub?: LocationInfo;
}

/** Reads KYWD editor IDs and LCTN records from all plugins; later plugins override earlier ones. */
export function loadLocations(plugins: PluginHeader[], stringsFor: (plugin: PluginHeader) => StringTable): Map<string, LocationInfo> {
  const keywords = new Map<string, string>();
  for (const plugin of plugins) {
    forEachRecord(plugin.path, ["KYWD"], (record) => {
      const editorId = record.subrecords.find((s) => s.type === "EDID");
      if (editorId) {
        keywords.set(formKey(record.formId, plugin), zstring(editorId.data));
      }
    });
  }

  const locations = new Map<string, LocationInfo>();
  for (const plugin of plugins) {
    const strings = stringsFor(plugin);
    forEachRecord(plugin.path, ["LCTN"], (record) => {
      const key = formKey(record.formId, plugin);
      const previous = locations.get(key);
      const get = (type: string) => record.subrecords.find((s) => s.type === type);

      const types: string[] = [];
      const kwda = get("KWDA");
      if (kwda) {
        for (let i = 0; i + 4 <= kwda.data.length; i += 4) {
          const keyword = keywords.get(formKey(kwda.data.readUInt32LE(i), plugin));
          if (keyword?.startsWith("LocType")) {
            types.push(keyword);
          }
        }
      }
      const full = get("FULL");
      const pnam = get("PNAM");
      locations.set(key, {
        key,
        editorId: zstring(get("EDID")?.data ?? Buffer.alloc(0)) || previous?.editorId || "",
        name: (full && readLString(full.data, plugin, strings)) || previous?.name || "",
        parent: pnam && pnam.data.length >= 4 ? formKey(pnam.data.readUInt32LE(0), plugin) : previous?.parent,
        types: kwda ? types : (previous?.types ?? []),
      });
    });
  }
  return locations;
}

const isSystem = (l: LocationInfo) => l.types.includes("LocTypeStarSystem");
const isPlanet = (l: LocationInfo) => l.types.includes("LocTypePlanet") || l.types.includes("LocTypeMoon");
const isConnector = (l: LocationInfo) => l.types.includes("LocTypeSurface") || l.types.includes("LocTypeOrbit");

/** Walks up from `key` and picks out the system, planet and hub. */
export function resolvePlace(key: string, locations: Map<string, LocationInfo>): ResolvedPlace {
  const chain: LocationInfo[] = [];
  const seen = new Set<string>();
  for (let current = locations.get(key); current && !seen.has(current.key); current = current.parent ? locations.get(current.parent) : undefined) {
    seen.add(current.key);
    chain.push(current);
  }

  const result: ResolvedPlace = {};
  for (let i = 0; i < chain.length; i++) {
    const node = chain[i];
    if (!result.system && isSystem(node)) {
      result.system = node;
    } else if (!result.planet && isPlanet(node)) {
      result.planet = node;
    } else if (!result.hub && i + 1 < chain.length && isConnector(chain[i + 1]) && !isConnector(node)) {
      result.hub = node;
    }
  }
  return result;
}
