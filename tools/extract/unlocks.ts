// Finds which quest stage starts each tracked quest, from the game's quest stage fragments
// (Fragments/Quests/QF_<EditorID>_<FormID>.psc in the Creation Kit's script sources, extracted
// to build/sf-scripts by `npm run build:mod`).
//
// Quest P unlocks quest Q at stage S when P's stage-S fragment starts Q (Q.Start()) or sets Q's
// start stage (Q.SetStage(n) / SetStageNoWait(n), n one of its three lowest stages above 0): setting a later
// stage only updates a quest that is already running. Debug, test and patch quests are ignored
// as sources. Quests started from dialogue, Story Manager events or regular scripts don't show
// up here; they stay "can be found" (questlines get a fallback in build-quest-drafts).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Unlock {
  /** Editor ID of the quest whose stage starts this one. */
  editorId: string;
  stage: number;
}

interface QuestInfo {
  editorId: string;
  stages: number[];
}

/** Unlocks per target editor ID (lower case), earliest-stage sources first. */
export function findUnlocks(scriptsDir: string, quests: QuestInfo[]): Map<string, Unlock[]> {
  const fragments = join(scriptsDir, "Fragments", "Quests");
  const out = new Map<string, Unlock[]>();
  if (!existsSync(fragments)) return out;
  const byId = new Map(quests.map((q) => [q.editorId.toLowerCase(), q]));
  // A quest's start is one of its first few stages (stage 1 is often a debug skip).
  const startStages = (q: QuestInfo) => [...new Set(q.stages.filter((s) => s > 0))].sort((x, y) => x - y).slice(0, 3);

  for (const file of readdirSync(fragments)) {
    const name = /^QF_(.+)_[0-9A-Fa-f]{8}\.psc$/.exec(file);
    if (!name) continue;
    const source = name[1];
    if (/test|debug|patch|^mq00$/i.test(source)) continue;
    const text = readFileSync(join(fragments, file), "utf8");
    // Quest properties of this fragment script: their names are the editor IDs of the quests.
    const questProps = new Set([...text.matchAll(/^\s*Quest\s+Property\s+(\w+)/gim)].map((m) => m[1].toLowerCase()));
    for (const fn of text.matchAll(/Function Fragment_Stage_(\d+)_Item_\d+\(\)([\s\S]*?)EndFunction/g)) {
      const stage = Number(fn[1]);
      for (const call of fn[2].matchAll(/^\s*(\w+)\.(Start|SetStage|SetStageNoWait)\(\s*(\d*)\s*\)/gm)) {
        const target = call[1].toLowerCase();
        const quest = byId.get(target);
        if (!quest || !questProps.has(target) || target === source.toLowerCase()) continue;
        const starts = call[2] === "Start" || startStages(quest).includes(Number(call[3]));
        if (!starts) continue;
        const list = out.get(target) ?? [];
        if (!list.some((u) => u.editorId === source && u.stage === stage)) list.push({ editorId: source, stage });
        out.set(target, list);
      }
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.stage - b.stage);
  return out;
}
