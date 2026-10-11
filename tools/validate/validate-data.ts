// Validates quest collections against data/schema/quests.schema.json, then checks
// references between entries (places, questlines, prerequisites, exclusive groups).
//
//   node tools/validate/validate-data.ts

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

interface Collection {
  id: string;
  places?: Array<{ id: string; parent?: string }>;
  questlines?: Array<{ id: string }>;
  quests: Array<{
    id: string;
    form: string;
    questline?: { id: string };
    start: { place: string };
    visits?: string[];
    prereqs?: string[];
    choices?: Array<{ group: string; side: string }>;
    missable?: { after: string } | null;
  }>;
}

const repo = fileURLToPath(new URL("../../", import.meta.url));
const schema = JSON.parse(readFileSync(join(repo, "data/schema/quests.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strictTypes: false }).compile(schema);

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return jsonFiles(path);
    }
    return name.endsWith(".json") ? [path] : [];
  });
}

const files = [join(repo, "data/schema/example.quests.json"), ...jsonFiles(join(repo, "data/quests"))];
const errors: string[] = [];
const report = (file: string, message: string): void => {
  errors.push(`${relative(repo, file)}: ${message}`);
};

function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

// The example is checked on its own so its IDs never clash with real data.
const groups = [[files[0]], files.slice(1)];

for (const group of groups) {
  const collections: Array<[string, Collection]> = [];
  for (const file of group) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      report(file, `invalid JSON: ${(error as Error).message}`);
      continue;
    }
    if (!validate(data)) {
      for (const issue of validate.errors ?? []) {
        report(file, `${issue.instancePath || "/"} ${issue.message}`);
      }
      continue;
    }
    collections.push([file, data as Collection]);
  }

  const allQuests = collections.flatMap(([, c]) => c.quests);
  const questIds = new Set(allQuests.map((q) => q.id));

  for (const id of findDuplicates(collections.map(([, c]) => c.id))) {
    errors.push(`duplicate collection id "${id}"`);
  }
  for (const id of findDuplicates(allQuests.map((q) => q.id))) {
    errors.push(`duplicate quest id "${id}"`);
  }
  for (const form of findDuplicates(allQuests.map((q) => q.form))) {
    errors.push(`quest form ${form} is listed more than once`);
  }

  // Every choice group needs quests on both sides, or nothing can ever lock out.
  const sides = new Map<string, Set<string>>();
  for (const quest of allQuests) {
    for (const choice of quest.choices ?? []) {
      sides.set(choice.group, (sides.get(choice.group) ?? new Set()).add(choice.side));
    }
  }
  for (const [name, present] of sides) {
    if (present.size < 2) {
      errors.push(`choice group "${name}" has quests on only one side`);
    }
  }

  for (const [file, collection] of collections) {
    const places = collection.places ?? [];
    const placeIds = new Set(places.map((p) => p.id));
    const questlineIds = new Set((collection.questlines ?? []).map((l) => l.id));

    for (const id of findDuplicates(places.map((p) => p.id))) {
      report(file, `duplicate place id "${id}"`);
    }
    for (const place of places) {
      if (place.parent && !placeIds.has(place.parent)) {
        report(file, `place "${place.id}" has unknown parent "${place.parent}"`);
      }
    }
    for (const quest of collection.quests) {
      const where = `quest "${quest.id}"`;
      if (!placeIds.has(quest.start.place)) {
        report(file, `${where} starts at unknown place "${quest.start.place}"`);
      }
      for (const place of quest.visits ?? []) {
        if (!placeIds.has(place)) {
          report(file, `${where} visits unknown place "${place}"`);
        }
      }
      if (quest.questline && !questlineIds.has(quest.questline.id)) {
        report(file, `${where} uses unknown questline "${quest.questline.id}"`);
      }
      for (const prereq of quest.prereqs ?? []) {
        if (!questIds.has(prereq)) {
          report(file, `${where} has unknown prerequisite "${prereq}"`);
        }
      }
      if (quest.missable && !questIds.has(quest.missable.after)) {
        report(file, `${where} is missable after unknown quest "${quest.missable.after}"`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} problem(s) in ${files.length} file(s).`);
  process.exit(1);
}
console.log(`OK: ${files.length} file(s) valid.`);
