// Reads the scripts attached to a record (VMAD) and their property values.
// Layout from xEdit's Starfield definitions: version, object format, then scripts, each with
// a name, flags and typed properties. Records with fragments (QUST, INFO, SCEN, PERK, TMLM)
// have more data after the scripts; it is ignored here.

/** A script property that points at a form (or a quest alias on one). */
export interface ScriptObject {
  form: number;
  alias: number;
}

export type ScriptValue = null | string | number | boolean | ScriptObject | ScriptValue[] | ScriptStruct;
export type ScriptStruct = Map<string, ScriptValue>;

export interface Script {
  name: string;
  properties: Map<string, ScriptValue>;
}

/** The scripts in a VMAD subrecord; stops quietly at data it can't read. */
export function readScripts(data: Buffer): Script[] {
  let pos = 0;
  const u8 = () => data[pos++];
  const u16 = () => ((pos += 2), data.readUInt16LE(pos - 2));
  const u32 = () => ((pos += 4), data.readUInt32LE(pos - 4));
  const str = () => {
    const length = u16();
    pos += length;
    return data.toString("utf8", pos - length, pos);
  };
  const objectFormat = data.readInt16LE(2);
  pos = 4;
  const object = (): ScriptObject => {
    if (objectFormat === 1) {
      const form = u32();
      const alias = data.readInt16LE(pos);
      pos += 4;
      return { form, alias };
    }
    pos += 2;
    const alias = data.readInt16LE(pos);
    pos += 2;
    return { alias, form: u32() };
  };
  const struct = (): ScriptStruct => {
    const members = new Map<string, ScriptValue>();
    for (let count = u32(); count > 0; count--) {
      const name = str();
      const type = u8();
      u8(); // flags
      members.set(name, value(type));
    }
    return members;
  };
  const array = <T>(read: () => T): T[] => Array.from({ length: u32() }, read);
  const value = (type: number): ScriptValue => {
    switch (type) {
      case 0:
      case 6:
        return null;
      case 1:
        return object();
      case 2:
        return str();
      case 3:
        return ((pos += 4), data.readInt32LE(pos - 4));
      case 4:
        return ((pos += 4), data.readFloatLE(pos - 4));
      case 5:
        return u8() !== 0;
      case 7:
        return struct();
      case 11:
        return array(object);
      case 12:
        return array(str);
      case 13:
        return array(() => ((pos += 4), data.readInt32LE(pos - 4)));
      case 14:
        return array(() => ((pos += 4), data.readFloatLE(pos - 4)));
      case 15:
        return array(() => u8() !== 0);
      case 16:
        u32(); // element count only
        return [];
      case 17:
        return array(struct);
      default:
        throw new Error(`unknown script property type ${type}`);
    }
  };

  const scripts: Script[] = [];
  try {
    for (let count = u16(); count > 0; count--) {
      const name = str();
      u8(); // flags
      const properties = new Map<string, ScriptValue>();
      for (let n = u16(); n > 0; n--) {
        const property = str();
        const type = u8();
        u8(); // flags
        properties.set(property, value(type));
      }
      scripts.push({ name, properties });
    }
  } catch {
    // Truncated or unexpected data: keep the scripts read so far.
  }
  return scripts;
}

export const isScriptObject = (value: ScriptValue | undefined): value is ScriptObject =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Map);
