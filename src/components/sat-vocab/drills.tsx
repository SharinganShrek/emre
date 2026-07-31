"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SatDrillType, SatWord } from "@/lib/sat-vocab/types";
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

export function DrillPicker({
  onPick,
  onCancel,
}: {
  onPick: (drill: SatDrillType) => void;
  onCancel: () => void;
}) {
  const options: { id: SatDrillType; title: string; blurb: string }[] = [
    {
      id: "matching",
      title: "Matching",
      blurb: "Match words to English definitions (5 at a time).",
    },
    {
      id: "type_word",
      title: "Type the word",
      blurb: "See the definition → type the SAT word.",
    },
    {
      id: "type_definition",
      title: "Type a keyword",
      blurb: "See the word → type a key word from the definition.",
    },
    {
      id: "multiple_choice",
      title: "Multiple choice",
      blurb: "Pick the correct English meaning.",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Choose a drill for this session:</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-2 touch-manipulation"
          >
            <p className="font-medium">{o.title}</p>
            <p className="mt-1 text-xs text-muted">{o.blurb}</p>
          </button>
        ))}
      </div>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

export function DrillRunner({
  words,
  drill,
  onWordResult,
  onFinish,
  onCancel,
}: {
  words: SatWord[];
  drill: SatDrillType;
  onWordResult: (word: string, correct: boolean) => void;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const pool = useMemo(() => shuffle(words).slice(0, Math.min(20, words.length)), [words]);

  if (drill === "matching") {
    return (
      <MatchingDrill
        words={pool}
        onWordResult={onWordResult}
        onFinish={onFinish}
        onCancel={onCancel}
      />
    );
  }
  if (drill === "multiple_choice") {
    return (
      <MultipleChoiceDrill
        words={pool}
        allWords={words}
        onWordResult={onWordResult}
        onFinish={onFinish}
        onCancel={onCancel}
      />
    );
  }
  if (drill === "type_word") {
    return (
      <TypeWordDrill
        words={pool}
        onWordResult={onWordResult}
        onFinish={onFinish}
        onCancel={onCancel}
      />
    );
  }
  return (
    <TypeDefinitionDrill
      words={pool}
      onWordResult={onWordResult}
      onFinish={onFinish}
      onCancel={onCancel}
    />
  );
}

function MatchingDrill({
  words,
  onWordResult,
  onFinish,
  onCancel,
}: {
  words: SatWord[];
  onWordResult: (word: string, correct: boolean) => void;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const chunks = useMemo(() => {
    const out: SatWord[][] = [];
    for (let i = 0; i < words.length; i += 5) out.push(words.slice(i, i + 5));
    return out;
  }, [words]);

  const [chunkIndex, setChunkIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const chunk = chunks[chunkIndex] ?? [];
  const defs = useMemo(
    () => shuffle(chunks[chunkIndex] ?? []),
    [chunkIndex, chunks],
  );

  function pickDef(defWord: SatWord) {
    if (!selectedWord) return;
    if (matched.has(selectedWord.toLowerCase())) return;
    setAttempts((a) => a + 1);
    const ok = selectedWord.toLowerCase() === defWord.word.toLowerCase();
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
          onFinish(
            Math.round((nextCorrect / Math.max(words.length, 1)) * 100),
          );
        } else {
          setChunkIndex((i) => i + 1);
          setMatched(new Set());
          setSelectedWord(null);
        }
      }
    } else {
      setWrongFlash(defWord.word);
      setTimeout(() => setWrongFlash(null), 500);
      setSelectedWord(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Matching set {chunkIndex + 1}/{chunks.length} · select a word, then its
        definition
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          {chunk.map((w) => {
            const done = matched.has(w.word.toLowerCase());
            return (
              <button
                key={w.word}
                type="button"
                disabled={done}
                onClick={() => setSelectedWord(w.word)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left text-sm touch-manipulation",
                  done && "opacity-40",
                  selectedWord === w.word
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface",
                )}
              >
                {w.word}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {defs.map((w) => (
            <button
              key={w.word + "-def"}
              type="button"
              onClick={() => pickDef(w)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left text-sm touch-manipulation",
                wrongFlash === w.word && "border-danger bg-danger/10",
                matched.has(w.word.toLowerCase())
                  ? "opacity-40"
                  : "border-border bg-surface",
              )}
            >
              {w.definition}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-2">
        Correct pairs: {correctCount} · Attempts: {attempts}
      </p>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Exit
      </Button>
    </div>
  );
}

function MultipleChoiceDrill({
  words,
  allWords,
  onWordResult,
  onFinish,
  onCancel,
}: {
  words: SatWord[];
  allWords: SatWord[];
  onWordResult: (word: string, correct: boolean) => void;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const [i, setI] = useState(0);
  const [correctN, setCorrectN] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const word = words[i];

  const choices = useMemo(() => {
    if (!word) return [];
    const distractors = shuffle(
      allWords.filter((w) => w.word !== word.word),
    ).slice(0, 3);
    return shuffle([word, ...distractors]);
  }, [word, allWords]);

  if (!word) return null;

  function choose(choice: SatWord) {
    if (picked) return;
    const ok = choice.word === word.word;
    setPicked(choice.word);
    onWordResult(word.word, ok);
    const nextCorrect = correctN + (ok ? 1 : 0);
    if (ok) setCorrectN(nextCorrect);
    setTimeout(() => {
      if (i >= words.length - 1) {
        onFinish(Math.round((nextCorrect / words.length) * 100));
      } else {
        setI((x) => x + 1);
        setPicked(null);
      }
    }, 650);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {i + 1}/{words.length}
      </p>
      <Card>
        <CardContent className="space-y-2 p-5">
          <div className="flex gap-2">
            <h2 className="text-2xl font-semibold">{word.word}</h2>
            <Badge>{word.pos}</Badge>
          </div>
          <p className="text-xs text-muted-2">Pick the correct definition</p>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {choices.map((c) => {
          const state =
            picked == null
              ? ""
              : c.word === word.word
                ? "border-success bg-success/10"
                : c.word === picked
                  ? "border-danger bg-danger/10"
                  : "opacity-50";
          return (
            <button
              key={c.word}
              type="button"
              onClick={() => choose(c)}
              className={cn(
                "w-full rounded-lg border border-border bg-surface px-3 py-3 text-left text-sm touch-manipulation",
                state,
              )}
            >
              {c.definition}
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

function TypeWordDrill({
  words,
  onWordResult,
  onFinish,
  onCancel,
}: {
  words: SatWord[];
  onWordResult: (word: string, correct: boolean) => void;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [correctN, setCorrectN] = useState(0);
  const word = words[i];
  if (!word) return null;

  function submit() {
    const ok = normalize(value) === normalize(word.word);
    onWordResult(word.word, ok);
    const next = correctN + (ok ? 1 : 0);
    if (ok) setCorrectN(next);
    setFeedback(ok ? "Correct" : `Answer: ${word.word}`);
    setTimeout(() => {
      setFeedback(null);
      setValue("");
      if (i >= words.length - 1) onFinish(Math.round((next / words.length) * 100));
      else setI((x) => x + 1);
    }, 900);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {i + 1}/{words.length} · type the word
      </p>
      <Card>
        <CardContent className="space-y-2 p-5">
          <p className="text-base">{word.definition}</p>
          <p className="text-xs text-muted-2">TR hint: {word.turkish}</p>
        </CardContent>
      </Card>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Type the English word…"
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

function TypeDefinitionDrill({
  words,
  onWordResult,
  onFinish,
  onCancel,
}: {
  words: SatWord[];
  onWordResult: (word: string, correct: boolean) => void;
  onFinish: (score: number) => void;
  onCancel: () => void;
}) {
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [correctN, setCorrectN] = useState(0);
  const word = words[i];
  if (!word) return null;

  const keywords = useMemo(() => {
    return word.definition
      .toLowerCase()
      .replace(/[^a-z\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4);
  }, [word]);

  function submit() {
    const answer = normalize(value);
    const ok =
      keywords.some((k) => answer.includes(k)) ||
      normalize(word.turkish)
        .split(/[,;]/)
        .some((t) => t && answer.includes(normalize(t)));
    onWordResult(word.word, ok);
    const next = correctN + (ok ? 1 : 0);
    if (ok) setCorrectN(next);
    setFeedback(ok ? "Accepted" : `Expected idea: ${word.definition}`);
    setTimeout(() => {
      setFeedback(null);
      setValue("");
      if (i >= words.length - 1) onFinish(Math.round((next / words.length) * 100));
      else setI((x) => x + 1);
    }, 1000);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {i + 1}/{words.length} · type a meaning keyword (EN or TR)
      </p>
      <Card>
        <CardContent className="p-5">
          <h2 className="text-2xl font-semibold">{word.word}</h2>
          <p className="text-xs text-muted-2">{word.pos}</p>
        </CardContent>
      </Card>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="e.g. rhythm / ritim"
        autoFocus
      />
      {feedback && <p className="text-sm text-muted">{feedback}</p>}
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
