"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SatWord } from "@/lib/sat-vocab/types";
import { cn } from "@/lib/utils";

export function FlashcardSession({
  words,
  onComplete,
  onCancel,
}: {
  words: SatWord[];
  onComplete: (knownWords: string[]) => void;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [detail, setDetail] = useState(false);
  const [known, setKnown] = useState<Set<string>>(() => new Set());

  const word = words[index];
  const progressPct = useMemo(
    () => Math.round(((index + (revealed ? 0.5 : 0)) / words.length) * 100),
    [index, revealed, words.length],
  );

  if (!word) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">No words in this session.</p>
        <Button onClick={onCancel}>Close</Button>
      </div>
    );
  }

  function mark(knew: boolean) {
    const next = new Set(known);
    if (knew) next.add(word.word.toLowerCase());
    else next.delete(word.word.toLowerCase());
    setKnown(next);

    if (index >= words.length - 1) {
      onComplete([...next]);
      return;
    }
    setIndex((i) => i + 1);
    setRevealed(false);
    setDetail(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Card {index + 1} / {words.length}
        </p>
        <p className="text-xs text-muted-2">{progressPct}%</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((index + 1) / words.length) * 100}%` }}
        />
      </div>

      <Card
        className={cn(
          "min-h-[280px] cursor-pointer touch-manipulation transition-colors",
          revealed ? "border-primary/40" : "",
        )}
        onClick={() => setRevealed(true)}
      >
        <CardContent className="flex min-h-[280px] flex-col justify-center gap-3 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-semibold tracking-tight">{word.word}</h2>
            <Badge variant="default">{word.pos}</Badge>
            <Badge variant="accent">{word.theme}</Badge>
          </div>

          {!revealed ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <EyeOff className="size-4" /> Tap to reveal meaning
            </p>
          ) : (
            <div className="space-y-3 text-sm" onClick={(e) => e.stopPropagation()}>
              <p className="text-base font-medium">{word.definition}</p>
              <p className="text-muted">
                <span className="text-xs text-muted-2">TR: </span>
                {word.turkish}
              </p>
              {word.study_split && (
                <p>
                  <span className="text-xs text-muted-2">Study split: </span>
                  <span className="font-mono">{word.study_split}</span>
                </p>
              )}
              {(word.root_family || word.prefix || word.suffix) && (
                <p className="text-muted">
                  {[
                    word.prefix && `prefix ${word.prefix}`,
                    word.root_family &&
                      `root ${word.root_family}${word.root_meaning ? ` (${word.root_meaning})` : ""}`,
                    word.suffix && `suffix ${word.suffix}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDetail((d) => !d)}
              >
                <Eye className="size-4" />
                {detail ? "Hide details" : "Show full details"}
              </Button>
              {detail && (
                <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">
                  {word.morphology_note && <p>{word.morphology_note}</p>}
                  {word.detailed_definition_en && (
                    <p>
                      <span className="font-medium text-foreground">EN: </span>
                      {word.detailed_definition_en}
                    </p>
                  )}
                  {word.detailed_definition_tr && (
                    <p>
                      <span className="font-medium text-foreground">TR: </span>
                      {word.detailed_definition_tr}
                    </p>
                  )}
                  {word.example_pattern && (
                    <p>
                      <span className="font-medium text-foreground">
                        Example:{" "}
                      </span>
                      {word.example_pattern}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => Math.max(0, i - 1));
            setRevealed(false);
            setDetail(false);
          }}
        >
          <ChevronLeft /> Back
        </Button>
        {!revealed ? (
          <Button size="sm" onClick={() => setRevealed(true)}>
            Reveal
          </Button>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={() => mark(false)}>
              Again
            </Button>
            <Button size="sm" onClick={() => mark(true)}>
              Got it <ChevronRight />
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={onCancel}>
          Exit
        </Button>
      </div>
    </div>
  );
}
