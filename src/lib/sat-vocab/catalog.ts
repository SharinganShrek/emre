import catalog from "./catalog.json";
import type { SatPlanDay, SatVocabData } from "./types";

/** Plan, themes, and meta only (~31KB) — safe for AI route cold starts. */
export const satVocabCatalog = catalog as Pick<
  SatVocabData,
  "meta" | "themes" | "plan"
>;

export const satPlanDays = satVocabCatalog.plan as SatPlanDay[];
