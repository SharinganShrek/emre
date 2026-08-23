"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type {
  SatGptMatchPair,
  SatGptMcItem,
  SatGptQueuedTest,
  SatGptTypeItem,
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

export function GptDrillRunner({
  test,
  onWordResult,
  onFinish,
  onCancel,
}: {
  test: SatGptQueuedTest;
  onWordResult: (word: string, correct: boolean) => void;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-2">
        Sent from GPT · {test.format.replaceAll("_", " ")}
        {test.title ? ` · ${test.title}` : ""}
      </p>
      {test.format === "matching" && (
        <GptMatching
          pairs={test.items as SatGptMatchPair[]}
          onWordResult={onWordResult}
          onFinish={onFinish}
          onCancel={onCancel}
        />
      )}
      {test.format === "multiple_choice" && (
        <GptMultipleChoice
          items={test.items as SatGptMcItem[]}
          onWordResult={onWordResult}
          onFinish={onFinish}
          onCancel={onCancel}
        />
      )}
      {(test.format === "type_word" || test.format === "type_definition") && (
        <GptType
          items={test.items as SatGptTypeItem[]}
          mode={test.format}
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
  onWordResult: (word: string, correct: boolean) => void;
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
    onWordResult(selectedWord, ok);
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

function GptMultipleChoice({
  items,
  onWordResult,
  onFinish,
  onCancel,
}: {
  items: SatGptMcItem[];
  onWordResult: (word: string, correct: boolean) => void;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const [i, setI] = useState(0);
  const [correctN, setCorrectN] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const item = items[i];
  const [orders] = useState(() => items.map((q) => shuffle(q.choices)));
  const choices = orders[i] ?? [];

  if (!item) return null;

  function choose(choice: string) {
    if (picked) return;
    const ok = normalize(choice) === normalize(item.answer);
    setPicked(choice);
    onWordResult(item.word, ok);
    const nextCorrect = correctN + (ok ? 1 : 0);
    if (ok) setCorrectN(nextCorrect);
    setTimeout(() => {
      if (i >= items.length - 1) {
        onFinish(Math.round((nextCorrect / items.length) * 100));
      } else {
        setI((x) => x + 1);
        setPicked(null);
      }
    }, 650);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {i + 1}/{items.length}
      </p>
      <Card>
        <CardContent className="p-5">
          <p className="text-base">{item.prompt}</p>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {choices.map((c) => {
          const state =
            picked == null
              ? ""
              : normalize(c) === normalize(item.answer)
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
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Exit
      </Button>
    </div>
  );
}

function GptType({
  items,
  mode,
  onWordResult,
  onFinish,
  onCancel,
}: {
  items: SatGptTypeItem[];
  mode: "type_word" | "type_definition";
  onWordResult: (word: string, correct: boolean) => void;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [correctN, setCorrectN] = useState(0);
  const item = items[i];
  if (!item) return null;

  function submit() {
    const answer = normalize(value);
    const ok = item.accepted.some((a) => {
      const n = normalize(a);
      return answer === n || answer.includes(n) || n.includes(answer);
    });
    onWordResult(item.word, ok);
    const next = correctN + (ok ? 1 : 0);
    if (ok) setCorrectN(next);
    setFeedback(ok ? "Correct" : `Answer: ${item.accepted[0]}`);
    setTimeout(() => {
      setFeedback(null);
      setValue("");
      if (i >= items.length - 1) {
        onFinish(Math.round((next / items.length) * 100));
      } else {
        setI((x) => x + 1);
      }
    }, 900);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {i + 1}/{items.length} ·{" "}
        {mode === "type_word" ? "type the word" : "type a meaning keyword"}
      </p>
      <Card>
        <CardContent className="p-5">
          <p className="text-base">{item.prompt}</p>
        </CardContent>
      </Card>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={
          mode === "type_word" ? "Type the English word…" : "Type a keyword…"
        }
        autoFocus
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
      <div className="flex gap-2">
        <Button size="sm" onClick={submit}>
          Check
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Exit
        </Button>
      </div>
    </div>
  );
}
