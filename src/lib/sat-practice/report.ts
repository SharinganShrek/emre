import { fixMathHtml } from "./mathml";
import { questionIsCorrect } from "./score";
import type {
  SatAnswerMap,
  SatFlagMap,
  SatModules,
  SatPart,
  SatPracticeAttempt,
  SatQuestionRow,
  SatSection,
  SatSectionModules,
  SatTimingMap,
} from "./types";
import { answerKey, emptySectionModules, isFullSat, SECTION_META } from "./types";

export function formatSpent(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function pushModule(
  rows: SatQuestionRow[],
  qs: SatSectionModules["m1"],
  module: 1 | 2,
  sectionKey: SatPart,
  answers: SatAnswerMap,
  flagged: SatFlagMap,
  secondsSpent: SatTimingMap,
  prefixed: boolean,
) {
  const sectionLabel = SECTION_META[sectionKey].label;
  (qs || []).forEach((question, index) => {
    const answerId = prefixed
      ? answerKey(module, index, sectionKey)
      : answerKey(module, index);
    const chosen = answers[answerId] || "";
    const isCorrect = questionIsCorrect(chosen, question);
    rows.push({
      key: answerId,
      module,
      index,
      number: rows.length + 1,
      sectionKey,
      sectionLabel,
      question,
      chosen: chosen || "—",
      correct: (question.correctAnswers || []).join(", ") || "—",
      isCorrect,
      flagged: !!flagged[answerId],
      secondsSpent:
        secondsSpent[answerId] == null ? null : Number(secondsSpent[answerId]),
    });
  });
}

export function flattenQuestions(
  section: SatSection,
  modules: SatModules,
  answers: SatAnswerMap = {},
  flagged: SatFlagMap = {},
  secondsSpent: SatTimingMap = {},
): SatQuestionRow[] {
  const rows: SatQuestionRow[] = [];
  if (section === "full" || modules.rw || modules.math) {
    const pushSection = (part: SatPart, mods: SatSectionModules | undefined) => {
      const block = mods || emptySectionModules();
      pushModule(rows, block.m1, 1, part, answers, flagged, secondsSpent, true);
      pushModule(rows, block.m2, 2, part, answers, flagged, secondsSpent, true);
    };
    pushSection("rw", modules.rw);
    pushSection("math", modules.math);
    return rows;
  }
  const part: SatPart = section === "math" ? "math" : "rw";
  pushModule(rows, modules.m1, 1, part, answers, flagged, secondsSpent, false);
  pushModule(rows, modules.m2, 2, part, answers, flagged, secondsSpent, false);
  return rows;
}

function domainLine(row: SatQuestionRow) {
  return [row.question.domain, row.question.skill, row.question.difficulty]
    .filter(Boolean)
    .join(" · ");
}

export function buildResultsReport(
  attempt: Pick<
    SatPracticeAttempt,
    | "section"
    | "source"
    | "title"
    | "modules"
    | "answers"
    | "flagged"
    | "seconds_spent"
    | "include_timing_in_report"
    | "raw_correct"
    | "raw_total"
    | "official_total"
    | "official_rw"
    | "official_math"
    | "domain_stats"
  >,
  opts?: { includeTiming?: boolean },
) {
  const includeTiming =
    opts?.includeTiming ?? attempt.include_timing_in_report;
  const rows = flattenQuestions(
    attempt.section,
    attempt.modules,
    attempt.answers,
    attempt.flagged,
    attempt.seconds_spent,
  );
  const correct = attempt.raw_correct ?? rows.filter((r) => r.isCorrect).length;
  const total = attempt.raw_total ?? rows.length;
  const stats =
    attempt.domain_stats && attempt.domain_stats.length
      ? attempt.domain_stats
      : [];
  const official = isFullSat(attempt);

  const lines = ["SAT®", "Results"];
  if (official && attempt.title) lines.push(String(attempt.title));
  if (official && attempt.official_total != null) {
    lines.push(`TOTAL SCORE ${attempt.official_total}`);
    if (attempt.official_rw != null) {
      lines.push(`Reading and Writing ${attempt.official_rw}`);
    }
    if (attempt.official_math != null) {
      lines.push(`Math ${attempt.official_math}`);
    }
  }
  lines.push(`${correct} / ${total} correct`, "Domain\tCorrect");
  for (const s of stats) {
    lines.push(`${s.domain}\t${s.correct} / ${s.total}`);
  }
  lines.push("Review");

  for (const row of rows) {
    const mark = row.isCorrect ? "Correct" : "Incorrect";
    const loc = official
      ? `${row.sectionLabel} · Module ${row.module}, Q${row.index + 1}`
      : `Module ${row.module}, Q${row.index + 1}`;
    lines.push(`${loc} ${mark}`);
    lines.push(domainLine(row));
    const stimulus = stripForReport(row.question.stimulus || "");
    const prompt = stripForReport(row.question.prompt || "");
    if (stimulus) lines.push(stimulus);
    if (prompt) {
      if (stimulus) lines.push("");
      lines.push(prompt);
    }
    if (row.question.answerOptions?.length) {
      lines.push("");
      for (const opt of row.question.answerOptions) {
        lines.push(`${opt.letter}. ${stripForReport(opt.content)}`);
      }
    }
    lines.push("");
    lines.push(`Your answer: ${row.chosen} · Correct: ${row.correct}`);
    if (includeTiming) {
      const spent = formatSpent(row.secondsSpent);
      lines.push(spent ? `Time spent: ${spent}` : "Time spent: —");
    }
    const rationale = stripForReport(row.question.rationale || "");
    if (rationale) {
      lines.push("");
      lines.push(rationale);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function stripForReport(html: string) {
  return fixMathHtml(String(html || ""))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&minus;/gi, "−")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
