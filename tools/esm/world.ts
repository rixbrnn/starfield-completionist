// Walks a plugin's CELL and WRLD groups: records which location each cell belongs to,
// and reports placed references (ACHR/REFR) together with the cell they sit in.

import { closeSync, fstatSync, openSync } from "node:fs";
import { readAt } from "./io.ts";
import { formKey, HEADER_SIZE, parseRecord, type PluginHeader, type PluginRecord } from "./plugin.ts";

export interface CellInfo {
  /** XLCN on the cell, if any. */
  location?: string;
  worldspace?: string;
}

export interface Placement {
  ref: string;
  type: string;
  /** NAME: the placed base object (NPC_ for actors). */
  base: string;
  cell?: string;
  /** XLCN on the reference itself (persistent location), if any. */
  location?: string;
}

// Group types whose label is the FormID of the cell that owns their contents.
const CELL_CHILDREN = new Set([6, 8, 9, 10]);
const WORLD_CHILDREN = 1;

interface Context {
  worldspace?: string;
  cell?: string;
}

function firstFormKey(record: PluginRecord, type: string, plugin: PluginHeader): string | undefined {
  const sub = record.subrecords.find((s) => s.type === type);
  return sub && sub.data.length >= 4 ? formKey(sub.data.readUInt32LE(0), plugin) : undefined;
}

/**
 * Scans CELL and WRLD groups. `wantRef` decides which ACHR/REFR records are parsed
 * (parsing every reference in the game is slow). Cells and worldspaces are always recorded.
 */
export function scanWorld(
  plugin: PluginHeader,
  wantRef: (type: "ACHR" | "REFR", rawFormId: number) => boolean,
  onPlacement: (placement: Placement) => void,
  cells: Map<string, CellInfo>,
  worldspaces: Map<string, CellInfo>,
): void {
  const walk = (buffer: Buffer, start: number, end: number, context: Context): void => {
    let pos = start;
    while (pos < end) {
      const type = buffer.toString("latin1", pos, pos + 4);
      const size = buffer.readUInt32LE(pos + 4);
      if (type === "GRUP") {
        const label = buffer.readUInt32LE(pos + 8);
        const groupType = buffer.readInt32LE(pos + 12);
        const child = { ...context };
        if (groupType === WORLD_CHILDREN) {
          child.worldspace = formKey(label, plugin);
        } else if (CELL_CHILDREN.has(groupType)) {
          child.cell = formKey(label, plugin);
        }
        walk(buffer, pos + HEADER_SIZE, pos + size, child);
        pos += size;
        continue;
      }

      if (type === "CELL" || type === "WRLD") {
        const record = parseRecord(buffer, pos);
        const key = formKey(record.formId, plugin);
        const info: CellInfo = { location: firstFormKey(record, "XLCN", plugin), worldspace: context.worldspace };
        // Overrides from later plugins may drop XLCN; keep what we already know.
        const target = type === "CELL" ? cells : worldspaces;
        const previous = target.get(key);
        target.set(key, { location: info.location ?? previous?.location, worldspace: info.worldspace ?? previous?.worldspace });
      } else if ((type === "ACHR" || type === "REFR") && wantRef(type, buffer.readUInt32LE(pos + 12))) {
        const record = parseRecord(buffer, pos);
        const base = firstFormKey(record, "NAME", plugin);
        if (base) {
          onPlacement({
            ref: formKey(record.formId, plugin),
            type,
            base,
            cell: context.cell,
            location: firstFormKey(record, "XLCN", plugin),
          });
        }
      }
      pos += HEADER_SIZE + size;
    }
  };

  const fd = openSync(plugin.path, "r");
  try {
    const fileSize = fstatSync(fd).size;
    let pos = HEADER_SIZE + readAt(fd, 0, HEADER_SIZE).readUInt32LE(4);
    while (pos < fileSize) {
      const header = readAt(fd, pos, HEADER_SIZE);
      const groupSize = header.readUInt32LE(4);
      const label = header.toString("latin1", 8, 12);
      if (label === "CELL" || label === "WRLD") {
        const body = readAt(fd, pos + HEADER_SIZE, groupSize - HEADER_SIZE);
        walk(body, 0, body.length, {});
      }
      pos += groupSize;
    }
  } finally {
    closeSync(fd);
  }
}
