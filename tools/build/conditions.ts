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
