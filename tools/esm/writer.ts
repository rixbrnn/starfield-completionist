// Minimal writer for Starfield plugin files: just enough to emit our own small .esm.
// Layouts match tools/esm/plugin.ts (24-byte record and group headers).

export const FORM_VERSION = 581; // what the official 1.16 masters use

export function subrecord(type: string, data: Buffer = Buffer.alloc(0)): Buffer {
  if (data.length > 0xffff) {
    throw new Error(`Subrecord ${type} is ${data.length} bytes; XXXX not supported`);
  }
  const header = Buffer.alloc(6);
  header.write(type, 0, 4, "latin1");
  header.writeUInt16LE(data.length, 4);
  return Buffer.concat([header, data]);
}

export function zstringData(text: string): Buffer {
  return Buffer.concat([Buffer.from(text, "utf8"), Buffer.alloc(1)]);
}

export function uint32Data(value: number): Buffer {
  const data = Buffer.alloc(4);
  data.writeUInt32LE(value >>> 0, 0);
  return data;
}

export function record(type: string, formId: number, subrecords: Buffer[], flags = 0): Buffer {
  const data = Buffer.concat(subrecords);
  const header = Buffer.alloc(24);
  header.write(type, 0, 4, "latin1");
  header.writeUInt32LE(data.length, 4);
  header.writeUInt32LE(flags >>> 0, 8);
  header.writeUInt32LE(formId >>> 0, 12);
  header.writeUInt16LE(FORM_VERSION, 20);
  return Buffer.concat([header, data]);
}

/** Top-level group (type 0) whose label is the record type it holds. */
export function group(label: string, records: Buffer[]): Buffer {
  const body = Buffer.concat(records);
  const header = Buffer.alloc(24);
  header.write("GRUP", 0, 4, "latin1");
  header.writeUInt32LE(body.length + 24, 4);
  header.write(label, 8, 4, "latin1");
  return Buffer.concat([header, body]);
}

/**
 * VMAD for a form with scripts that have no properties (version 6, object format 2,
 * the layout official Starfield quests use).
 */
export function vmadData(scripts: string[]): Buffer {
  const parts: Buffer[] = [];
  const head = Buffer.alloc(6);
  head.writeInt16LE(6, 0); // version
  head.writeInt16LE(2, 2); // object format
  head.writeUInt16LE(scripts.length, 4);
  parts.push(head);
  for (const name of scripts) {
    const nameBytes = Buffer.from(name, "utf8");
    const length = Buffer.alloc(2);
    length.writeUInt16LE(nameBytes.length, 0);
    parts.push(length, nameBytes, Buffer.from([0x00]), Buffer.from([0x00, 0x00])); // flags, property count
  }
  return Buffer.concat(parts);
}

export interface PluginOptions {
  author: string;
  masters: string[];
  /** TES4 flags; 0x1 = master. */
  flags: number;
  nextObjectId: number;
}

export function pluginFile(options: PluginOptions, groups: Buffer[], recordCount: number): Buffer {
  const hedr = Buffer.alloc(12);
  hedr.writeFloatLE(0.96, 0);
  hedr.writeUInt32LE(recordCount, 4);
  hedr.writeUInt32LE(options.nextObjectId, 8);
  const tes4 = record(
    "TES4",
    0,
    [
      subrecord("HEDR", hedr),
      subrecord("CNAM", zstringData(options.author)),
      ...options.masters.map((master) => subrecord("MAST", zstringData(master))),
    ],
    options.flags,
  );
  return Buffer.concat([tes4, ...groups]);
}
