// Minimal reader for Creation Engine 2 plugin files (.esm/.esp).
// Record and group headers are 24 bytes; compressed records are zlib.

import { closeSync, fstatSync, openSync } from "node:fs";
import { basename } from "node:path";
import { inflateSync } from "node:zlib";
import { readAt, zstring } from "./io.ts";

export interface Subrecord {
  type: string;
  data: Buffer;
}

export interface PluginRecord {
  type: string;
  flags: number;
  formId: number;
  formVersion: number;
  subrecords: Subrecord[];
}

export interface PluginHeader {
  name: string;
  path: string;
  flags: number;
  localized: boolean;
  masters: string[];
}

export const HEADER_SIZE = 24;
const RECORD_FLAG_COMPRESSED = 0x00040000;
const TES4_FLAG_LOCALIZED = 0x80;

export function parseSubrecords(data: Buffer): Subrecord[] {
  const subrecords: Subrecord[] = [];
  let pos = 0;
  let oversize: number | undefined;
  while (pos + 6 <= data.length) {
    const type = data.toString("latin1", pos, pos + 4);
    let size = data.readUInt16LE(pos + 4);
    pos += 6;
    if (type === "XXXX") {
      // The next subrecord's real size doesn't fit in 16 bits.
      oversize = data.readUInt32LE(pos);
      pos += size;
      continue;
    }
    if (oversize !== undefined) {
      size = oversize;
      oversize = undefined;
    }
    subrecords.push({ type, data: data.subarray(pos, pos + size) });
    pos += size;
  }
  return subrecords;
}

export function parseRecord(buffer: Buffer, offset: number): PluginRecord {
  const dataSize = buffer.readUInt32LE(offset + 4);
  const flags = buffer.readUInt32LE(offset + 8);
  let data = buffer.subarray(offset + HEADER_SIZE, offset + HEADER_SIZE + dataSize);
  if ((flags & RECORD_FLAG_COMPRESSED) !== 0) {
    // First 4 bytes hold the decompressed size.
    data = inflateSync(data.subarray(4));
  }
  return {
    type: buffer.toString("latin1", offset, offset + 4),
    flags,
    formId: buffer.readUInt32LE(offset + 12),
    formVersion: buffer.readUInt16LE(offset + 20),
    subrecords: parseSubrecords(data),
  };
}

type RecordFilter = (type: string, rawFormId: number) => boolean;

function walkGroup(
  buffer: Buffer,
  start: number,
  end: number,
  wanted: RecordFilter,
  onRecord: (record: PluginRecord) => void,
): void {
  let pos = start;
  while (pos < end) {
    const type = buffer.toString("latin1", pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    if (type === "GRUP") {
      // Group size includes its own header.
      walkGroup(buffer, pos + HEADER_SIZE, pos + size, wanted, onRecord);
      pos += size;
    } else {
      if (wanted(type, buffer.readUInt32LE(pos + 12))) {
        onRecord(parseRecord(buffer, pos));
      }
      pos += HEADER_SIZE + size;
    }
  }
}

function walkTopLevelGroups(
  path: string,
  wantGroup: (label: string) => boolean,
  wanted: RecordFilter,
  onRecord: (record: PluginRecord) => void,
): void {
  const fd = openSync(path, "r");
  try {
    const fileSize = fstatSync(fd).size;
    let pos = HEADER_SIZE + readAt(fd, 0, HEADER_SIZE).readUInt32LE(4);
    while (pos < fileSize) {
      const header = readAt(fd, pos, HEADER_SIZE);
      const type = header.toString("latin1", 0, 4);
      if (type !== "GRUP") {
        throw new Error(`Expected a top-level group at byte ${pos} of ${path}, found ${type}`);
      }
      const groupSize = header.readUInt32LE(4);
      if (wantGroup(header.toString("latin1", 8, 12))) {
        const body = readAt(fd, pos + HEADER_SIZE, groupSize - HEADER_SIZE);
        walkGroup(body, 0, body.length, wanted, onRecord);
      }
      pos += groupSize;
    }
  } finally {
    closeSync(fd);
  }
}

export function readPluginHeader(path: string): PluginHeader {
  const fd = openSync(path, "r");
  try {
    const header = readAt(fd, 0, HEADER_SIZE);
    if (header.toString("latin1", 0, 4) !== "TES4") {
      throw new Error(`${path} is not a plugin file`);
    }
    const record = parseRecord(Buffer.concat([header, readAt(fd, HEADER_SIZE, header.readUInt32LE(4))]), 0);
    return {
      name: basename(path),
      path,
      flags: record.flags,
      localized: (record.flags & TES4_FLAG_LOCALIZED) !== 0,
      masters: record.subrecords.filter((s) => s.type === "MAST").map((s) => zstring(s.data)),
    };
  } finally {
    closeSync(fd);
  }
}

/**
 * Calls `onRecord` for every record of the given types found inside the
 * top-level groups labelled with one of `groups` (defaults to `types`).
 * Other top-level groups are skipped without being read.
 */
export function forEachRecord(
  path: string,
  types: string[],
  onRecord: (record: PluginRecord) => void,
  groups: string[] = types,
): void {
  const wantedTypes = new Set(types);
  const wantedGroups = new Set(groups);
  walkTopLevelGroups(
    path,
    (label) => wantedGroups.has(label),
    (type) => wantedTypes.has(type),
    onRecord,
  );
}

/** Scans every group of `plugin` for records whose formKey is in `keys`. */
export function findRecords(
  plugin: PluginHeader,
  keys: Set<string>,
  onRecord: (record: PluginRecord, key: string) => void,
): void {
  walkTopLevelGroups(
    plugin.path,
    () => true,
    (_type, rawFormId) => keys.has(formKey(rawFormId, plugin)),
    (record) => onRecord(record, formKey(record.formId, plugin)),
  );
}

/**
 * Formats a raw FormID as "Owner.esm|0x00ABCD". The top byte is an index into the
 * plugin's masters; anything past the list (including the 0xFD/0xFE prefixes that
 * Starfield's medium/small masters use for their own records) means the plugin itself.
 */
export function formKey(rawFormId: number, plugin: PluginHeader): string {
  const index = rawFormId >>> 24;
  const owner = index < plugin.masters.length ? plugin.masters[index] : plugin.name;
  const local = (rawFormId & 0xffffff).toString(16).toUpperCase().padStart(6, "0");
  return `${owner}|0x${local}`;
}
