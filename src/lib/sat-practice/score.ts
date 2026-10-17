import type {
  SatAnswerMap,
  SatDifficulty,
  SatDomainStat,
  SatModules,
  SatPart,
  SatQuestion,
  SatSection,
  SatSectionModules,
} from "./types";
import {
  answerKey,
  emptySectionModules,
  MATH_DOMAIN_ORDER,
  RW_DOMAIN_ORDER,
} from "./types";

const DIFF_CODE: Record<string, "E" | "M" | "H"> = {
  E: "E",
  Easy: "E",
  M: "M",
  Medium: "M",
  H: "H",
  Hard: "H",
};

export function difficultyBand(value: SatDifficulty | string | undefined) {
  return DIFF_CODE[String(value || "")] || "M";
}

export function answersMatch(chosen: string | undefined, correctAnswers: string[]) {
  const c = String(chosen || "").trim();
  if (!c || c === "—" || c === "-") return false;
  for (const raw of correctAnswers || []) {
    const a = String(raw || "").trim();
    if (!a) continue;
    if (c.toUpperCase() === a.toUpperCase()) return true;
    const n1 = Number(c.replace(/,/g, ""));
    const n2 = Number(a.replace(/,/g, ""));
    if (!Number.isNaN(n1) && !Number.isNaN(n2) && n1 === n2) return true;
  }
  return false;
}

export function questionIsCorrect(
  chosen: string | undefined,
  question: Pick<SatQuestion, "correctAnswers" | "creditGiven"> | undefined,
) {
  if (question?.creditGiven) return true;
  return answersMatch(chosen, question?.correctAnswers || []);
}

/**
 * Albert.io Digital SAT calculator module tables
 * (https://www.albert.io/blog/sat-score-calculator/).
 * Index = raw correct in that module. Section score = M1 + M2, clamped 200–800.
 * Unofficial; Albert aligns these to College Board practice-test curves.
 */
const RW_MODULE1 = [
  100, 100, 120, 140, 160, 170, 180, 190, 200, 200, 210, 210, 220, 230, 240,
  260, 270, 290, 310, 320, 340, 360, 370, 390, 410, 430, 440, 460,
];
const RW_MODULE2 = [
  100, 100, 100, 110, 110, 110, 120, 120, 120, 130, 130, 140, 150, 170, 190,
  190, 200, 210, 230, 240, 250, 260, 280, 290, 300, 310, 330, 340,
];
const MATH_MODULE1 = [
  100, 100, 120, 140, 160, 160, 180, 180, 200, 200, 210, 240, 260, 280, 300,
  320, 340, 360, 390, 410, 430, 450, 470,
];
const MATH_MODULE2 = [
  100, 100, 100, 120, 120, 130, 150, 170, 170, 170, 190, 190, 200, 200, 210,
  230, 240, 260, 270, 290, 300, 320, 330,
];

function lookupModuleScore(table: readonly number[], raw: number) {
  const i = Math.max(0, Math.min(table.length - 1, Math.round(raw)));
  return table[i] ?? table[0];
}

function evenModuleSplit(raw: number, moduleSize: number) {
  const m1 = Math.min(moduleSize, Math.round(raw / 2));
  const m2 = Math.min(moduleSize, Math.max(0, raw - m1));
  return { m1, m2 };
}

/** Estimated section scale (200–800). Albert per-module tables, not official CB. */
export function estimateScaledScore(
  section: SatPart,
  raw: number,
  m1Correct?: number,
  m2Correct?: number,
) {
  const moduleSize = section === "rw" ? 27 : 22;
  const split =
    m1Correct == null || m2Correct == null
      ? evenModuleSplit(raw, moduleSize)
      : {
          m1: Math.max(0, m1Correct),
          m2: Math.max(0, m2Correct),
        };
  const tables = section === "rw" ? [RW_MODULE1, RW_MODULE2] : [MATH_MODULE1, MATH_MODULE2];
  const scaled =
    lookupModuleScore(tables[0], split.m1) + lookupModuleScore(tables[1], split.m2);
  return Math.max(200, Math.min(800, scaled));
}

function canonicalDomain(section: SatPart, domain: string, domainCode?: string) {
  const code = String(domainCode || "").toUpperCase();
  if (section === "rw") {
    if (code === "CAS" || /craft/i.test(domain)) return "Craft and Structure";
    if (code === "INI" || /information/i.test(domain)) return "Information and Ideas";
    if (code === "SEC" || /convention/i.test(domain)) return "Standard English Conventions";
    if (code === "EOI" || /expression/i.test(domain)) return "Expression of Ideas";
  } else {
    if (code === "H" || /^algebra$/i.test(domain)) return "Algebra";
    if (code === "P" || /advanced/i.test(domain)) return "Advanced Math";
    if (code === "Q" || /problem|data/i.test(domain))
      return "Problem-Solving and Data Analysis";
    if (code === "S" || /geometry|trig/i.test(domain))
      return "Geometry and Trigonometry";
  }
  return domain || "Other";
}

function barsFromDifficulty(easy: [number, number], medium: [number, number], hard: [number, number]) {
  const fill = (pair: [number, number], slots: number) => {
    const [ok, total] = pair;
    if (total <= 0) return 0;
    return Math.round((ok / total) * slots);
  };
  return Math.max(0, Math.min(7, fill(easy, 3) + fill(medium, 2) + fill(hard, 2)));
}

function scoreSection(
  section: SatPart,
  modules: SatSectionModules,
  answers: SatAnswerMap,
  keySection?: SatPart,
) {
  const order = section === "rw" ? RW_DOMAIN_ORDER : MATH_DOMAIN_ORDER;
  const buckets = new Map<string, SatDomainStat>();
  for (const domain of order) {
    buckets.set(domain, {
      domain,
      correct: 0,
      total: 0,
      easyCorrect: 0,
      easyTotal: 0,
      mediumCorrect: 0,
      mediumTotal: 0,
      hardCorrect: 0,
      hardTotal: 0,
      bars: 0,
    });
  }

  let correct = 0;
  let total = 0;
  let m1Correct = 0;
  let m2Correct = 0;
  const visit = (qs: SatQuestion[], module: 1 | 2) => {
    qs.forEach((q, i) => {
      total += 1;
      const ok = questionIsCorrect(
        answers[answerKey(module, i, keySection)],
        q,
      );
      if (ok) {
        correct += 1;
        if (module === 1) m1Correct += 1;
        else m2Correct += 1;
      }
      const domain = canonicalDomain(section, q.domain, q.domainCode);
      let row = buckets.get(domain);
      if (!row) {
        row = {
          domain,
          domainCode: q.domainCode,
          correct: 0,
          total: 0,
          easyCorrect: 0,
          easyTotal: 0,
          mediumCorrect: 0,
          mediumTotal: 0,
          hardCorrect: 0,
          hardTotal: 0,
          bars: 0,
        };
        buckets.set(domain, row);
      }
      row.total += 1;
      if (ok) row.correct += 1;
      const band = difficultyBand(q.difficultyCode || q.difficulty);
      if (band === "E") {
        row.easyTotal += 1;
        if (ok) row.easyCorrect += 1;
      } else if (band === "H") {
        row.hardTotal += 1;
        if (ok) row.hardCorrect += 1;
      } else {
        row.mediumTotal += 1;
        if (ok) row.mediumCorrect += 1;
      }
    });
  };
  visit(modules.m1 || [], 1);
  visit(modules.m2 || [], 2);

  const domain_stats = [...buckets.values()].map((row) => ({
    ...row,
    bars: barsFromDifficulty(
      [row.easyCorrect, row.easyTotal],
      [row.mediumCorrect, row.mediumTotal],
      [row.hardCorrect, row.hardTotal],
    ),
  }));

  return {
    raw_correct: correct,
    raw_total: total,
    scaled_estimated: estimateScaledScore(section, correct, m1Correct, m2Correct),
    domain_stats,
  };
}

export function scoreAttempt(section: SatSection, modules: SatModules, answers: SatAnswerMap) {
  if (section === "full") {
    const rw = scoreSection("rw", modules.rw || emptySectionModules(), answers, "rw");
    const math = scoreSection("math", modules.math || emptySectionModules(), answers, "math");
    return {
      raw_correct: rw.raw_correct + math.raw_correct,
      raw_total: rw.raw_total + math.raw_total,
      scaled_estimated: (rw.scaled_estimated || 0) + (math.scaled_estimated || 0),
      domain_stats: [...rw.domain_stats, ...math.domain_stats],
    };
  }
  return scoreSection(section, modules, answers);
}
