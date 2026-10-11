// Reader for general-purpose (GNRL) BA2 archives, enough to pull out string tables.

import { closeSync, fstatSync, openSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { readAt } from "./io.ts";

export interface Ba2Entry {
  /** Lower-case path with forward slashes, e.g. "strings/starfield_en.strings". */
  name: string;
  offset: number;
  packedSize: number;
  unpackedSize: number;
}

export interface Ba2Archive {
  path: string;
  version: number;
  compression: "zlib" | "lz4";
  entries: Ba2Entry[];
}

const ENTRY_SIZE = 36;

/** Returns undefined for texture (DX10) archives and non-BA2 files. */
export function openBa2(path: string): Ba2Archive | undefined {
  const fd = openSync(path, "r");
  try {
    const header = readAt(fd, 0, 36);
    if (header.toString("latin1", 0, 4) !== "BTDX" || header.toString("latin1", 8, 12) !== "GNRL") {
      return undefined;
    }
    const version = header.readUInt32LE(4);
    const fileCount = header.readUInt32LE(12);
    const nameTableOffset = Number(header.readBigUInt64LE(16));

    let headerSize = 24;
    let compression: Ba2Archive["compression"] = "zlib";
    if (version >= 2) {
      headerSize += 8;
    }
    if (version === 3) {
      compression = header.readUInt32LE(32) === 3 ? "lz4" : "zlib";
      headerSize += 4;
    }

    const table = readAt(fd, headerSize, fileCount * ENTRY_SIZE);
    const names = readAt(fd, nameTableOffset, fstatSync(fd).size - nameTableOffset);

    const entries: Ba2Entry[] = [];
    let namePos = 0;
    for (let i = 0; i < fileCount; i++) {
      const length = names.readUInt16LE(namePos);
      const name = names.toString("utf8", namePos + 2, namePos + 2 + length);
      namePos += 2 + length;
      const at = i * ENTRY_SIZE;
      entries.push({
        name: name.replaceAll("\\", "/").toLowerCase(),
        offset: Number(table.readBigUInt64LE(at + 16)),
        packedSize: table.readUInt32LE(at + 24),
        unpackedSize: table.readUInt32LE(at + 28),
      });
    }
    return { path, version, compression, entries };
  } finally {
    closeSync(fd);
  }
}

export function readBa2Entry(archive: Ba2Archive, entry: Ba2Entry): Buffer {
  const fd = openSync(archive.path, "r");
  try {
    if (entry.packedSize === 0) {
      return readAt(fd, entry.offset, entry.unpackedSize);
    }
    const packed = readAt(fd, entry.offset, entry.packedSize);
    return archive.compression === "lz4" ? lz4BlockDecompress(packed, entry.unpackedSize) : inflateSync(packed);
  } finally {
    closeSync(fd);
  }
}

function lz4BlockDecompress(src: Buffer, outputSize: number): Buffer {
  const out = Buffer.alloc(outputSize);
  let s = 0;
  let d = 0;
  while (s < src.length) {
    const token = src[s++];

    let literals = token >> 4;
    if (literals === 15) {
      let b: number;
      do {
        b = src[s++];
        literals += b;
      } while (b === 255);
    }
    src.copy(out, d, s, s + literals);
    s += literals;
    d += literals;
    if (s >= src.length) {
      break;
    }

    const offset = src[s] | (src[s + 1] << 8);
    s += 2;
    let match = token & 15;
    if (match === 15) {
      let b: number;
      do {
        b = src[s++];
        match += b;
      } while (b === 255);
    }
    match += 4;
    for (let i = 0; i < match; i++, d++) {
      out[d] = out[d - offset];
    }
  }
  return out;
}
