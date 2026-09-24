import { fixMathHtml } from "./mathml";
import type { SatAnswerMap, SatModules, SatQuestion, SatSectionModules } from "./types";
import { allQuestions } from "./types";

const DATA_TAG = '<script id="DATA" type="application/json">';

export function parseMockHtml(html: string): SatModules | null {
  const source = String(html || "");
  const start = source.indexOf(DATA_TAG);
  if (start < 0) return null;
  const end = source.indexOf("</script>", start);
  if (end < 0) return null;
  try {
    const data = JSON.parse(source.slice(start + DATA_TAG.length, end)) as {
      m1?: unknown;
      m2?: unknown;
    };
    const m1 = normalizeQuestions(data.m1);
    const m2 = normalizeQuestions(data.m2);
    if (!m1.length && !m2.length) return null;
    return { m1, m2 };
  } catch {
    return null;
  }
}

export function modulesNeedChoices(modules: SatModules | null | undefined) {
  const qs = allQuestions(modules);
  if (!qs.length) return true;
  return qs.some((q) => !q.answerOptions?.length);
}

export function mergeQuestionBank(
  base: SatModules,
  extra: SatModules | null | undefined,
): SatModules {
  if (!extra) return base;
  return {
    m1: mergeList(base.m1, extra.m1),
    m2: mergeList(base.m2, extra.m2),
    rw: mergeNested(base.rw, extra.rw),
    math: mergeNested(base.math, extra.math),
  };
}

function mergeNested(
  base?: SatSectionModules,
  extra?: SatSectionModules,
): SatSectionModules | undefined {
  if (!base && !extra) return undefined;
  return {
    m1: mergeList(base?.m1, extra?.m1),
    m2: mergeList(base?.m2, extra?.m2),
  };
}

function mergeList(base: SatQuestion[] = [], extra: SatQuestion[] = []) {
  if (!extra.length) return base;
  if (!base.length) return extra;
  return base.map((question, index) => mergeQuestion(question, extra[index]));
}

function mergeQuestion(base: SatQuestion, extra?: SatQuestion): SatQuestion {
  if (!extra) return base;
  return {
    ...base,
    externalId: base.externalId || extra.externalId,
    domainCode: base.domainCode || extra.domainCode,
    domain: extra.domain || base.domain,
    skillCode: base.skillCode || extra.skillCode,
    skill: extra.skill || base.skill,
    difficultyCode: base.difficultyCode || extra.difficultyCode,
    difficulty: extra.difficulty || base.difficulty,
    stimulus: extra.stimulus || base.stimulus,
    prompt: extra.prompt || base.prompt,
    answerOptions: extra.answerOptions?.length
      ? extra.answerOptions
      : base.answerOptions || [],
    correctAnswers: base.correctAnswers?.length
      ? base.correctAnswers
      : extra.correctAnswers || [],
    rationale: extra.rationale || base.rationale,
    creditGiven: Boolean(base.creditGiven || extra.creditGiven) || undefined,
  };
}

function normalizeQuestions(raw: unknown): SatQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeQuestion);
}

export function normalizeSectionModules(raw: unknown): SatSectionModules {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    m1: normalizeQuestions(obj.m1),
    m2: normalizeQuestions(obj.m2),
  };
}

export function normalizeModules(raw: SatModules | null | undefined): SatModules {
  const obj = raw || { m1: [], m2: [] };
  return {
    m1: normalizeQuestions(obj.m1),
    m2: normalizeQuestions(obj.m2),
    rw: obj.rw ? normalizeSectionModules(obj.rw) : undefined,
    math: obj.math ? normalizeSectionModules(obj.math) : undefined,
  };
}

export function normalizeAnswerMap(raw: unknown): SatAnswerMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SatAnswerMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) out[key] = text;
  }
  return out;
}

export function normalizeQuestion(raw: unknown): SatQuestion {
  const q = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const opts = Array.isArray(q.answerOptions) ? q.answerOptions : [];
  const correct = Array.isArray(q.correctAnswers)
    ? q.correctAnswers
    : q.correctAnswers
      ? [q.correctAnswers]
      : [];
  return {
    externalId: String(q.externalId || q.external_id || ""),
    domainCode: String(q.domainCode || ""),
    domain: String(q.domain || ""),
    skillCode: String(q.skillCode || ""),
    skill: String(q.skill || ""),
    difficultyCode: String(q.difficultyCode || ""),
    difficulty: String(q.difficulty || ""),
    stimulus: fixMathHtml(String(q.stimulus || "")),
    prompt: fixMathHtml(String(q.prompt || "")),
    answerOptions: opts.map((opt, i) => {
      const row =
        opt && typeof opt === "object" ? (opt as Record<string, unknown>) : {};
      return {
        letter: String(row.letter || String.fromCharCode(65 + i)),
        content: fixMathHtml(String(row.content || "")),
      };
    }),
    correctAnswers: correct.map((value) => String(value || "").trim()).filter(Boolean),
    rationale: fixMathHtml(String(q.rationale || "")),
    creditGiven: q.creditGiven ? true : undefined,
  };
}
