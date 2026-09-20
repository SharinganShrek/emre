import { scoreAttempt } from "./score";
import type { SatAnswerMap, SatModules, SatQuestion, SatSection } from "./types";
import { answerKey } from "./types";

const QUESTION_RE = /Module\s+(\d+),\s*Q(\d+)\s+(Correct|Incorrect)\s*\n/g;

export function parseResultsReport(text: string, section: SatSection = "rw") {
  const source = text.replace(/\r\n/g, "\n").trim();
  const matches = [...source.matchAll(QUESTION_RE)];
  const m1: SatQuestion[] = [];
  const m2: SatQuestion[] = [];
  const answers: SatAnswerMap = {};

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const module = Number(match[1]) === 2 ? 2 : 1;
    const index = Number(match[2]) - 1;
    const start = (match.index || 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index || source.length : source.length;
    const block = source.slice(start, end).trim();
    const parsed = parseQuestionBlock(block);
    const q: SatQuestion = {
      externalId: "",
      domain: parsed.domain,
      skill: parsed.skill,
      difficulty: parsed.difficulty,
      stimulus: parsed.stimulus,
      prompt: parsed.prompt,
      answerOptions: [],
      correctAnswers: parsed.correct ? [parsed.correct] : [],
      rationale: parsed.rationale,
    };
    if (module === 1) m1[index] = q;
    else m2[index] = q;
    if (parsed.chosen) answers[answerKey(module, index)] = parsed.chosen;
  }

  const compact = (arr: Array<SatQuestion | undefined>) =>
    arr.filter((q): q is SatQuestion => !!q);

  const modules: SatModules = { m1: compact(m1), m2: compact(m2) };
  const scored = scoreAttempt(section, modules, answers);
  return { modules, answers, ...scored };
}

function parseQuestionBlock(block: string) {
  const lines = block.split("\n");
  const meta = (lines[0] || "").split("·").map((s) => s.trim());
  const domain = meta[0] || "";
  const skill = meta[1] || "";
  const difficulty = meta[2] || "";
  const rest = lines.slice(1).join("\n").trim();
  const answerMatch = rest.match(
    /Your answer:\s*([A-D0-9./—\-]+)\s*·\s*Correct:\s*([A-D0-9., /]+)/i,
  );
  let body = rest;
  let rationale = "";
  let chosen = "";
  let correct = "";
  if (answerMatch && answerMatch.index != null) {
    body = rest.slice(0, answerMatch.index).trim();
    chosen = answerMatch[1].trim();
    correct = answerMatch[2].split(",")[0].trim();
    rationale = rest.slice(answerMatch.index + answerMatch[0].length).trim();
  }
  return {
    domain,
    skill,
    difficulty,
    stimulus: "",
    prompt: body,
    chosen,
    correct,
    rationale,
  };
}
