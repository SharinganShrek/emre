"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type {
  SatGptItem,
  SatGptMatchPair,
  SatGptQueuedTest,
  SatWordResultHandler,
} from "@/lib/sat-vocab/types";
import { cn } from "@/lib/utils";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

type SequentialItem = Exclude<SatGptItem, { kind: "matching" }>;

type LegacyGptItem = {
  kind?: SatGptItem["kind"];
  word: string;
  prompt?: string;
  choices?: string[];
  answer?: string;
  accepted?: string[];
  definition?: string;
};

function tagQueuedItems(test: SatGptQueuedTest): SatGptItem[] {
  return (test.items as LegacyGptItem[]).map((item) => {
    if (item.kind === "multiple_choice") {
      return {
        kind: "multiple_choice" as const,
        word: item.word,
        prompt: item.prompt ?? "",
        choices: item.choices ?? [],
        answer: item.answer ?? "",
      };
    }
    if (item.kind === "type_word" || item.kind === "type_definition") {
      return {
        kind: item.kind,
        word: item.word,
        prompt: item.prompt ?? "",
        accepted: item.accepted ?? [item.word],
      };
    }
    if (item.kind === "matching") {
      return {
        kind: "matching" as const,
        word: item.word,
        definition: item.definition ?? "",
      };
    }
    if (item.choices) {
      return {
        kind: "multiple_choice" as const,
        word: item.word,
        prompt: item.prompt ?? "",
        choices: item.choices,
        answer: item.answer ?? item.choices[0] ?? "",
      };
    }
    if (item.definition && !item.prompt) {
      return {
        kind: "matching" as const,
        word: item.word,
        definition: item.definition,
      };
    }
    return {
      kind: test.format === "type_definition" ? "type_definition" : "type_word",
      word: item.word,
      prompt: item.prompt ?? "",
      accepted: item.accepted ?? [item.word],
    };
  });
}

export function GptDrillRunner({
  test,
  onWordResult,
  onFinish,
  onCancel,
}: {
  test: SatGptQueuedTest;
  onWordResult: SatWordResultHandler;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const items = useMemo(() => tagQueuedItems(test), [test]);
  const matching = items.filter(
    (item): item is SatGptItem & { kind: "matching" } =>
      item.kind === "matching" || test.format === "matching",
  );
  const sequential = items.filter(
    (item): item is SequentialItem =>
      item.kind === "multiple_choice" ||
      item.kind === "type_word" ||
      item.kind === "type_definition",
  );
  const useMatching =
    test.format === "matching" ||
    (matching.length > 0 && sequential.length === 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-2">
        Sent from GPT · {test.format.replaceAll("_", " ")}
        {test.title ? ` · ${test.title}` : ""}
      </p>
      {useMatching ? (
        <GptMatching
          pairs={matching.length ? matching : (items as SatGptMatchPair[])}
          onWordResult={onWordResult}
          onFinish={onFinish}
          onCancel={onCancel}
        />
      ) : (
        <GptItemSequence
          items={sequential}
          onWordResult={onWordResult}
          onFinish={onFinish}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

function GptMatching({
  pairs,
  onWordResult,
  onFinish,
  onCancel,
}: {
  pairs: SatGptMatchPair[];
  onWordResult: SatWordResultHandler;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const chunks = useMemo(() => {
    const out: SatGptMatchPair[][] = [];
    for (let i = 0; i < pairs.length; i += 5) out.push(pairs.slice(i, i + 5));
    return out;
  }, [pairs]);

  const [chunkIndex, setChunkIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const chunk = chunks[chunkIndex] ?? [];
  const defs = useMemo(
    () => shuffle(chunks[chunkIndex] ?? []),
    [chunkIndex, chunks],
  );

  function pickDef(pair: SatGptMatchPair) {
    if (!selectedWord) return;
    if (matched.has(selectedWord.toLowerCase())) return;
    const ok = selectedWord.toLowerCase() === pair.word.toLowerCase();
    const expected =
      chunk.find((p) => p.word.toLowerCase() === selectedWord.toLowerCase())
        ?.definition ?? selectedWord;
    onWordResult(selectedWord, ok, {
      chosen: pair.definition,
      expected,
    });
    if (ok) {
      const next = new Set(matched);
      next.add(selectedWord.toLowerCase());
      const nextCorrect = correctCount + 1;
      setMatched(next);
      setCorrectCount(nextCorrect);
      setSelectedWord(null);
      if (next.size >= chunk.length) {
        if (chunkIndex >= chunks.length - 1) {
          onFinish(Math.round((nextCorrect / Math.max(pairs.length, 1)) * 100));
        } else {
          setChunkIndex((i) => i + 1);
          setMatched(new Set());
        }
      }
    } else {
      setWrongFlash(pair.word);
      setTimeout(() => setWrongFlash(null), 500);
      setSelectedWord(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Matching set {chunkIndex + 1}/{chunks.length}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          {chunk.map((p) => {
            const done = matched.has(p.word.toLowerCase());
            return (
              <button
                key={p.word}
                type="button"
                disabled={done}
                onClick={() => setSelectedWord(p.word)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left text-sm touch-manipulation",
                  done && "opacity-40",
                  selectedWord === p.word
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface",
                )}
              >
                {p.word}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {defs.map((p) => (
            <button
              key={`${p.word}-def`}
              type="button"
              onClick={() => pickDef(p)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left text-sm touch-manipulation",
                wrongFlash === p.word && "border-danger bg-danger/10",
                matched.has(p.word.toLowerCase())
                  ? "opacity-40"
                  : "border-border bg-surface",
              )}
            >
              {p.definition}
            </button>
          ))}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Exit
      </Button>
    </div>
  );
}

function kindLabel(kind: SequentialItem["kind"]) {
  if (kind === "multiple_choice") return "context multiple choice";
  if (kind === "type_word") return "type the word";
  return "type a meaning";
}

function GptItemSequence({
  items,
  onWordResult,
  onFinish,
  onCancel,
}: {
  items: SequentialItem[];
  onWordResult: SatWordResultHandler;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const [i, setI] = useState(0);
  const [correctN, setCorrectN] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [orders] = useState(() =>
    items.map((item) =>
      item.kind === "multiple_choice" ? shuffle(item.choices) : [],
    ),
  );

  const current = items[i];
  if (!current) return null;

  function advance(nextCorrect: number) {
    setPicked(null);
    setValue("");
    setFeedback(null);
    if (i >= items.length - 1) {
      onFinish(Math.round((nextCorrect / items.length) * 100));
    } else {
      setI((x) => x + 1);
    }
  }

  function settle(
    ok: boolean,
    detail: { chosen: string; expected: string },
  ) {
    onWordResult(current.word, ok, detail);
    const nextCorrect = correctN + (ok ? 1 : 0);
    if (ok) setCorrectN(nextCorrect);
    setTimeout(
      () => advance(nextCorrect),
      current.kind === "multiple_choice" ? 650 : 900,
    );
  }

  function choose(choice: string) {
    if (current.kind !== "multiple_choice" || picked) return;
    const ok = normalize(choice) === normalize(current.answer);
    setPicked(choice);
    settle(ok, { chosen: choice, expected: current.answer });
  }

  function submitType() {
    if (
      (current.kind !== "type_word" && current.kind !== "type_definition") ||
      feedback
    ) {
      return;
    }
    const answer = normalize(value);
    const ok = current.accepted.some((a) => {
      const n = normalize(a);
      return answer === n || answer.includes(n) || n.includes(answer);
    });
    setFeedback(ok ? "Correct" : `Answer: ${current.accepted[0]}`);
    settle(ok, { chosen: value, expected: current.accepted[0] ?? "" });
  }

  const choices = orders[i] ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {i + 1}/{items.length} · {kindLabel(current.kind)}
      </p>
      <Card>
        <CardContent className="p-5">
          <p className="text-base">{current.prompt}</p>
        </CardContent>
      </Card>

      {current.kind === "multiple_choice" && (
        <div className="space-y-2">
          {choices.map((c) => {
            const state =
              picked == null
                ? ""
                : normalize(c) === normalize(current.answer)
                  ? "border-success bg-success/10"
                  : c === picked
                    ? "border-danger bg-danger/10"
                    : "opacity-50";
            return (
              <button
                key={c}
                type="button"
                onClick={() => choose(c)}
                className={cn(
                  "w-full rounded-lg border border-border bg-surface px-3 py-3 text-left text-sm touch-manipulation",
                  state,
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {(current.kind === "type_word" || current.kind === "type_definition") && (
        <>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitType();
            }}
            placeholder={
              current.kind === "type_word"
                ? "Type the English word…"
                : "Type a keyword…"
            }
            autoFocus
            disabled={Boolean(feedback)}
          />
          {feedback && (
            <p
              className={cn(
                "text-sm",
                feedback === "Correct" ? "text-success" : "text-warning",
              )}
            >
              {feedback}
            </p>
          )}
          {!feedback && (
            <Button size="sm" onClick={submitType}>
              Check
            </Button>
          )}
        </>
      )}

      <Button size="sm" variant="ghost" onClick={onCancel}>
        Exit
      </Button>
    </div>
  );
}
