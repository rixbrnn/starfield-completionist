// Completion / failure conditions from data/quests (see data/schema/quests.schema.json), as the
// game-side tracker reads them: shared by build-mod (the Papyrus table) and validate-data.

export interface Condition {
  type: string;
  stage?: number;
  form?: string;
  conditions?: Condition[];
}

/**
 * The quest's own stages that the tracker tests: questStage conditions, alone or in anyOf.
 * Stages of another quest (form), questStageRecorded and allOf aren't in the Papyrus table.
 */
export function stagesOf(condition: Condition | null | undefined): number[] {
  if (!condition) return [];
  if (condition.type === "questStage" && condition.stage !== undefined && !condition.form) return [condition.stage];
  if (condition.type === "anyOf") return (condition.conditions ?? []).flatMap(stagesOf);
  return [];
}

/**
 * Stages the tracker tests on both sides. It checks failure first, so such a stage would always
 * read as failed: the extractor counts it as completed, and the build and validator reject it.
 */
export function overlappingStages(complete: Condition | null | undefined, fail: Condition | null | undefined): number[] {
  const completeStages = stagesOf(complete);
  return stagesOf(fail).filter((stage) => completeStages.includes(stage));
}
