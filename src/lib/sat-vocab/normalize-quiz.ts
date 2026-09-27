/**
 * Models often send quiz items without the `kind` discriminator, or with
 * aliases (question, options, correct_answer). Map those onto the schema
 * satVocabProgressWrite expects before Zod runs.
 */

const KIND_ALIAS: Record<string, string> = {
  multiple_choice: "multiple_choice",
  multiplechoice: "multiple_choice",
  "multiple-choice": "multiple_choice",
  "multiple choice": "multiple_choice",
  mc: "multiple_choice",
  type_word: "type_word",
  typeword: "type_word",
  "type-word": "type_word",
  "type word": "type_word",
  type_definition: "type_definition",
  typedefinition: "type_definition",
  "type-definition": "type_definition",
  "type definition": "type_definition",
  matching: "matching",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  const row = asRecord(value);
  if (!row) return "";
  for (const key of ["text", "content", "label", "choice", "value", "answer"]) {
    if (typeof row[key] === "string" && row[key].trim()) return row[key].trim();
  }
  return "";
}

function stringList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  return raw.map(textOf).filter(Boolean);
}

function kindOf(item: Record<string, unknown>, format: string): string {
  const raw = item.kind ?? item.type ?? item.question_type ?? item.item_type;
  const mapped =
    typeof raw === "string" ? KIND_ALIAS[raw.trim().toLowerCase()] : undefined;
  if (mapped) return mapped;
  if (format === "multiple_choice" || format === "type_word" || format === "type_definition" || format === "matching") {
    return format;
  }
  if (stringList(item.choices ?? item.options).length >= 2) return "multiple_choice";
  if (stringList(item.accepted ?? item.answers).length >= 1) {
    const prompt = textOf(item.prompt ?? item.question ?? item.stem);
    const word = textOf(item.word ?? item.term);
    if (prompt && word && prompt.toLowerCase() === word.toLowerCase()) {
      return "type_definition";
    }
    return "type_word";
  }
  if (textOf(item.definition ?? item.meaning)) return "matching";
  return "";
}

function normalizeItem(value: unknown, format: string): unknown {
  const parsed = parseMaybeJson(value);
  const item = asRecord(parsed);
  if (!item) return value;
  const kind = kindOf(item, format);
  const word = textOf(item.word ?? item.term ?? item.left);
  const prompt = textOf(item.prompt ?? item.question ?? item.stem ?? item.text) || word;
  const choices = stringList(item.choices ?? item.options);
  let answer: unknown = item.answer ?? item.correct ?? item.correct_answer ?? item.correctAnswer;
  if (answer == null) {
    const marked = (Array.isArray(item.choices) ? item.choices : Array.isArray(item.options) ? item.options : [])
      .map(asRecord)
      .find((row) => row && (row.correct === true || row.is_correct === true));
    if (marked) answer = textOf(marked);
  }
  if (typeof answer === "string") answer = answer.trim();
  const accepted = stringList(item.accepted ?? item.answers ?? item.expected);
  const definition = textOf(item.definition ?? item.meaning ?? item.right);

  if (kind === "multiple_choice") {
    return { kind, word, prompt, choices, answer };
  }
  if (kind === "type_word" || kind === "type_definition") {
    return { kind, word, prompt, accepted: accepted.length ? accepted : word ? [word] : [] };
  }
  if (kind === "matching" || format === "matching") {
    return { word, definition };
  }
  return { ...item, kind, word, prompt, choices, answer, accepted };
}

function normalizeTest(value: unknown): unknown {
  const parsed = parseMaybeJson(value);
  const test = asRecord(parsed);
  if (!test) return value;
  const formatRaw = typeof test.format === "string" ? test.format.trim().toLowerCase() : "";
  const format = KIND_ALIAS[formatRaw] ?? formatRaw;
  const items = Array.isArray(test.items)
    ? test.items.map((item) => normalizeItem(item, format))
    : test.items;
  return { ...test, format: format || test.format, items };
}

export function normalizeSatVocabWrite(raw: unknown): unknown {
  const parsed = parseMaybeJson(raw);
  const body = asRecord(parsed);
  if (!body) return raw;
  if (body.action !== "send_test" && body.action !== "send_review_test") return body;
  return { ...body, test: normalizeTest(body.test) };
}
