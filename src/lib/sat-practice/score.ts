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

function interpolate(raw: number, max: number, points: Array<[number, number]>) {
  const x = Math.max(0, Math.min(max, raw));
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return Math.round((y0 + (y1 - y0) * t) / 10) * 10;
    }
  }
  return points[points.length - 1][1];
}

/** Estimated section scale (200–800). Not an official College Board conversion. */
export function estimateScaledScore(section: SatPart, raw: number) {
  if (section === "rw") {
    return interpolate(raw, 54, [
      [0, 200],
      [8, 340],
      [16, 450],
      [24, 540],
      [32, 620],
      [40, 690],
      [44, 710],
      [48, 730],
      [50, 750],
      [52, 770],
      [54, 800],
    ]);
  }
  return interpolate(raw, 44, [
    [0, 200],
    [6, 350],
    [12, 460],
    [18, 550],
    [24, 630],
    [30, 690],
    [35, 740],
    [40, 770],
    [42, 790],
    [44, 800],
  ]);
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
  const visit = (qs: SatQuestion[], module: 1 | 2) => {
    qs.forEach((q, i) => {
      total += 1;
      const ok = questionIsCorrect(
        answers[answerKey(module, i, keySection)],
        q,
      );
      if (ok) correct += 1;
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
    scaled_estimated: estimateScaledScore(section, correct),
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
