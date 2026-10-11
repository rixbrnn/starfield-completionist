import { readSync } from "node:fs";

/** Reads exactly `length` bytes at `position`, throwing on a short read. */
export function readAt(fd: number, position: number, length: number): Buffer {
  const buffer = Buffer.allocUnsafe(length);
  let done = 0;
  while (done < length) {
    const n = readSync(fd, buffer, done, length - done, position + done);
    if (n === 0) {
      throw new Error(`Unexpected end of file at byte ${position + done}`);
    }
    done += n;
  }
  return buffer;
}

/** Reads a null-terminated UTF-8 string from the start of `data`. */
export function zstring(data: Buffer): string {
  const end = data.indexOf(0);
  return data.toString("utf8", 0, end === -1 ? data.length : end);
}
