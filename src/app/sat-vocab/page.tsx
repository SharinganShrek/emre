"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Play,
  FlaskConical,
  Layers,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { StatCard } from "@/components/ui/stat-card";
import { Hydrated } from "@/components/hydrated";
import { FlashcardSession } from "@/components/sat-vocab/flashcards";
import { DrillPicker, DrillRunner } from "@/components/sat-vocab/drills";
import {
  getWordsForPlanDay,
  satVocabData,
  wordsByTheme,
} from "@/lib/sat-vocab";
import { SatVocabProvider, useSatVocab } from "@/lib/sat-vocab/store";
import {
  isSessionComplete,
  type SatDrillType,
  type SatPlanDay,
  type SatWord,
} from "@/lib/sat-vocab/types";
import { toast } from "@/lib/toast";
import { cn, todayISO } from "@/lib/utils";

const TABS = ["Plan", "Themes", "Calendar", "Weak words"] as const;
type Tab = (typeof TABS)[number];

export default function SatVocabPage() {
  return (
    <Hydrated>
      <SatVocabProvider>
        <SatVocabApp />
      </SatVocabProvider>
    </Hydrated>
  );
}

function SatVocabApp() {
  const { loading, summary, source, saving, dirty } = useSatVocab();
  const [tab, setTab] = useState<Tab>("Plan");

  if (loading) {
    return <p className="text-sm text-muted">Loading SAT vocabulary…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SAT Vocab"
        description={`${satVocabData.meta.word_count} words · 10-week plan from ${satVocabData.meta.plan_start} · 20 words / learn day`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sessions learned"
          value={`${summary.learned}/${summary.learn_total}`}
        />
        <StatCard
          label="Sessions tested"
          value={`${summary.tested}/${summary.learn_total}`}
        />
        <StatCard
          label="Calendar days done"
          value={`${summary.completed_days}/${summary.plan_total}`}
        />
        <StatCard
          label="Words touched"
          value={`${summary.words_touched}/${summary.words_total}`}
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm touch-manipulation",
              tab === t
                ? "bg-surface-2 font-medium"
                : "text-muted hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Plan" && <PlanTab />}
      {tab === "Themes" && <ThemesTab />}
      {tab === "Calendar" && <CalendarTab />}
      {tab === "Weak words" && <WeakWordsTab />}

      <p className="text-xs text-muted-2">
        Progress: {source === "supabase" ? "Supabase sync" : "local browser"}
        {dirty || saving ? " · saving…" : " · up to date"}
      </p>
    </div>
  );
}

function PlanTab() {
  const { progress, markLearned, markTested, recordWordResult, markRestDone } =
    useSatVocab();
  const today = todayISO();
  const [active, setActive] = useState<SatPlanDay | null>(null);
  const [mode, setMode] = useState<"flash" | "pick" | "drill" | null>(null);
  const [drill, setDrill] = useState<SatDrillType | null>(null);

  const words = useMemo(
    () => (active ? getWordsForPlanDay(active) : []),
    [active],
  );

  function openLearn(day: SatPlanDay) {
    setActive(day);
    setMode("flash");
    setDrill(null);
  }

  function openTest(day: SatPlanDay) {
    setActive(day);
    setMode("pick");
    setDrill(null);
  }

  return (
    <div className="space-y-3">
      {satVocabData.plan.map((day) => {
        const sp = progress.sessions[day.id];
        const done = isSessionComplete(day, sp);
        const isToday = day.scheduled_date === today;
        return (
          <Card
            key={day.id}
            className={cn(
              isToday && "border-primary/50",
              done && "opacity-90",
            )}
          >
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    Week {day.week} · {day.session_label}
                  </p>
                  {isToday && <Badge variant="accent">Today</Badge>}
                  {done && (
                    <Badge variant="success">
                      <CheckCircle2 className="size-3" /> Done
                    </Badge>
                  )}
                  {sp?.learned && !sp?.tested && day.kind === "learn" && (
                    <Badge variant="warning">Learned · test next</Badge>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {day.scheduled_date} · {day.theme_focus}
                  {day.kind === "learn" ? ` · ${day.words.length} words` : ""}
                </p>
                {day.task_note && (
                  <p className="text-xs text-muted-2">{day.task_note}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {day.kind === "learn" && (
                  <>
                    <Button size="sm" onClick={() => openLearn(day)}>
                      <Play /> Start session
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!sp?.learned}
                      onClick={() => openTest(day)}
                    >
                      <FlaskConical /> Test session
                    </Button>
                  </>
                )}
                {day.kind === "review" && (
                  <Button size="sm" onClick={() => openTest(day)}>
                    <FlaskConical /> Weekly review test
                  </Button>
                )}
                {day.kind === "rest" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      markRestDone(day.id);
                      toast.success("Rest day marked");
                    }}
                  >
                    Mark rest done
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={Boolean(active && mode)}
        onClose={() => {
          setActive(null);
          setMode(null);
          setDrill(null);
        }}
        title={
          active
            ? `${active.session_label} · ${active.scheduled_date}`
            : "Session"
        }
      >
        {active && mode === "flash" && (
          <FlashcardSession
            words={words}
            onCancel={() => {
              setActive(null);
              setMode(null);
            }}
            onComplete={(known) => {
              markLearned(active.id, known);
              toast.success(
                "Session learned — calendar updates after you also finish a test",
              );
              setMode("pick");
            }}
          />
        )}
        {active && mode === "pick" && (
          <DrillPicker
            onCancel={() => {
              setActive(null);
              setMode(null);
            }}
            onPick={(d) => {
              setDrill(d);
              setMode("drill");
            }}
          />
        )}
        {active && mode === "drill" && drill && (
          <DrillRunner
            words={words}
            drill={drill}
            onWordResult={recordWordResult}
            onCancel={() => {
              setActive(null);
              setMode(null);
              setDrill(null);
            }}
            onFinish={(score) => {
              markTested(active.id, drill, score);
              if (active.kind === "learn" && !progress.sessions[active.id]?.learned) {
                markLearned(active.id);
              }
              if (active.kind === "review") {
                markLearned(active.id);
              }
              toast.success(`Test finished · score ${score}%`);
              setActive(null);
              setMode(null);
              setDrill(null);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function ThemesTab() {
  const [theme, setTheme] = useState(satVocabData.themes[0]?.theme ?? "");
  const [selected, setSelected] = useState<SatWord | null>(null);
  const list = useMemo(() => wordsByTheme(theme), [theme]);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="space-y-1">
        {satVocabData.themes.map((t) => (
          <button
            key={t.theme}
            type="button"
            onClick={() => setTheme(t.theme)}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-left text-sm touch-manipulation",
              theme === t.theme
                ? "bg-surface-2 font-medium"
                : "text-muted hover:bg-surface-2/60",
            )}
          >
            <span className="text-xs text-muted-2">{t.order}. </span>
            {t.theme}
            <span className="ml-1 text-xs text-muted-2">({t.word_count})</span>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">{theme}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((w) => (
            <button
              key={w.word}
              type="button"
              onClick={() => setSelected(w)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:bg-surface-2 touch-manipulation"
            >
              <p className="font-medium">
                {w.no}. {w.word}{" "}
                <span className="text-xs font-normal text-muted-2">{w.pos}</span>
              </p>
              <p className="truncate text-xs text-muted">{w.definition}</p>
              <p className="truncate text-xs text-muted-2">{w.turkish}</p>
            </button>
          ))}
        </div>
      </div>

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.word ?? "Word"}
      >
        {selected && <WordDetail word={selected} />}
      </Dialog>
    </div>
  );
}

function WordDetail({ word }: { word: SatWord }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge>{word.pos}</Badge>
        <Badge variant="accent">{word.theme}</Badge>
      </div>
      <p className="font-medium">{word.definition}</p>
      <p className="text-muted">TR: {word.turkish}</p>
      {word.study_split && (
        <p>
          <span className="text-xs text-muted-2">Study split: </span>
          <span className="font-mono">{word.study_split}</span>
        </p>
      )}
      <p className="text-xs text-muted">{word.morphology_note}</p>
      {word.detailed_definition_en && (
        <p className="text-xs leading-relaxed text-muted">
          <BookOpen className="mr-1 inline size-3" />
          {word.detailed_definition_en}
        </p>
      )}
      {word.detailed_definition_tr && (
        <p className="text-xs leading-relaxed text-muted">
          {word.detailed_definition_tr}
        </p>
      )}
      {word.example_pattern && (
        <p className="text-xs text-muted-2">{word.example_pattern}</p>
      )}
    </div>
  );
}

function CalendarTab() {
  const { progress } = useSatVocab();
  const completed = new Set(progress.completed_dates);
  const byMonth = useMemo(() => {
    const map = new Map<string, SatPlanDay[]>();
    for (const day of satVocabData.plan) {
      const key = day.scheduled_date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(day);
    }
    return [...map.entries()];
  }, []);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Days turn green when a learn session is both studied and tested (review
        days: finish a test; rest: mark done). Start date:{" "}
        {satVocabData.meta.plan_start}.
      </p>
      {byMonth.map(([month, days]) => (
        <Card key={month}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" /> {month}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {days.map((d) => {
              const done = completed.has(d.scheduled_date);
              return (
                <div
                  key={d.id}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    done
                      ? "border-success/40 bg-success/10"
                      : "border-border bg-surface",
                  )}
                >
                  <p className="font-medium">{d.scheduled_date}</p>
                  <p className="text-xs text-muted">
                    {d.session_label} · {d.kind}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WeakWordsTab() {
  const { progress } = useSatVocab();
  const weak = useMemo(() => {
    return Object.entries(progress.word_stats)
      .map(([word, s]) => ({
        word,
        ...s,
        rate: s.seen ? s.correct / s.seen : 0,
      }))
      .filter((w) => w.seen >= 1 && w.rate < 0.7)
      .sort((a, b) => a.rate - b.rate || b.wrong - a.wrong)
      .slice(0, 40);
  }, [progress.word_stats]);

  if (weak.length === 0) {
    return (
      <p className="text-sm text-muted">
        No weak words yet — finish a few tests and misses will show up here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Accuracy under 70% (from your drills). Revisit these in flashcards.
      </p>
      {weak.map((w) => {
        const full = satVocabData.words.find(
          (x) => x.word.toLowerCase() === w.word,
        );
        return (
          <Card key={w.word}>
            <CardContent className="flex items-start justify-between gap-3 p-3">
              <div>
                <p className="font-medium">
                  <Layers className="mr-1 inline size-3.5" />
                  {full?.word ?? w.word}
                </p>
                <p className="text-xs text-muted">{full?.definition}</p>
                <p className="text-xs text-muted-2">{full?.turkish}</p>
              </div>
              <Badge variant="warning">
                {Math.round(w.rate * 100)}% · {w.wrong} miss
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
