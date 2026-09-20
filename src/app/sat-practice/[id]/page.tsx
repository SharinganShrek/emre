"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { flattenQuestions } from "@/lib/sat-practice/report";
import type { SatPracticeAttempt, SatQuestionRow } from "@/lib/sat-practice/types";
import { SECTION_META } from "@/lib/sat-practice/types";

type Tab = "all" | "rw" | "math";

export default function SatPracticeDetailsPage() {
  const params = useParams<{ id: string }>();
  const [attempt, setAttempt] = useState<SatPracticeAttempt | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [showCorrect, setShowCorrect] = useState(false);
  const [pageSize, setPageSize] = useState<10 | 30 | "all">(10);
  const [review, setReview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sat-practice/${params.id}`);
    const json = (await res.json()) as {
      attempt?: SatPracticeAttempt;
      report?: string;
      error?: string;
    };
    if (!res.ok || !json.attempt) throw new Error(json.error || "Not found");
    setAttempt(json.attempt);
    setReport(json.report || "");
  }, [params.id]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const rows = useMemo(() => {
    if (!attempt) return [];
    return flattenQuestions(
      attempt.section,
      attempt.modules,
      attempt.answers,
      attempt.flagged,
      attempt.seconds_spent,
    );
  }, [attempt]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    if (tab === "rw") return attempt?.section === "rw" ? rows : [];
    return attempt?.section === "math" ? rows : [];
  }, [attempt, rows, tab]);

  const visible =
    pageSize === "all" ? filtered : filtered.slice(0, pageSize);
  const correct = filtered.filter((r) => r.isCorrect).length;
  const reviewRow = review != null ? filtered[review] : null;

  async function toggleTiming() {
    if (!attempt) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sat-practice/${attempt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          include_timing_in_report: !attempt.include_timing_in_report,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      await load();
      toast.success(
        !attempt.include_timing_in_report
          ? "Timing will appear in this mock’s report and GPT text."
          : "Timing hidden for this mock.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }
  if (!attempt) {
    return <p className="text-sm text-muted">Loading score details…</p>;
  }

  const date = new Date(attempt.completed_at || attempt.created_at);
  const misses = filtered.filter((r) => !r.isCorrect);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/sat-practice" className="text-sm text-primary">
          ← SAT Practice
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          SAT {attempt.title} —{" "}
          {date.toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h1>
      </div>

      <div className="flex gap-6 border-b border-border text-sm">
        {(
          [
            ["all", "All Questions"],
            ["rw", "Reading and Writing"],
            ["math", "Math"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setReview(null);
            }}
            className={cn(
              "border-b-2 px-1 pb-2",
              tab === id
                ? "border-foreground font-medium"
                : "border-transparent text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <section>
        <h2 className="text-xl font-semibold">Questions Overview</h2>
        <p className="text-sm text-muted">
          Review your results for each question from this practice test.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat value={filtered.length} label="Total Questions" />
          <Stat value={correct} label="Correct Answers" />
          <Stat value={filtered.length - correct} label="Incorrect Answers" />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showCorrect}
            onChange={(e) => setShowCorrect(e.target.checked)}
          />
          Show Correct Answers
        </label>
        <div className="text-sm text-muted">
          View:{" "}
          {([10, 30, "all"] as const).map((n) => (
            <button
              key={String(n)}
              type="button"
              onClick={() => setPageSize(n)}
              className={cn(
                "px-1.5",
                pageSize === n ? "font-semibold text-foreground" : "text-primary",
              )}
            >
              {n === "all" ? "All" : n}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Section</th>
              <th className="px-3 py-2">Correct Answer</th>
              <th className="px-3 py-2">Your Answer</th>
              <th className="px-3 py-2">Actions</th>
              <th className="px-3 py-2">Domain</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.key} className="border-t border-border">
                <td className="px-3 py-2 tabular-nums">{row.number}</td>
                <td className="px-3 py-2">{row.sectionLabel}</td>
                <td className="px-3 py-2">
                  {showCorrect ? row.correct : ""}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 font-medium",
                    row.isCorrect ? "text-success" : "text-danger",
                  )}
                >
                  {showCorrect
                    ? row.chosen
                    : row.isCorrect
                      ? "Correct"
                      : "Incorrect"}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setReview(i)}
                  >
                    Review
                  </button>
                </td>
                <td className="px-3 py-2">{row.question.domain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Results analysis</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={attempt.include_timing_in_report}
              disabled={saving}
              onChange={toggleTiming}
            />
            Include time spent in this report / GPT
          </label>
        </div>
        <p className="mt-1 text-sm text-muted">
          Same layout as the mock HTML results. Custom GPT reads this text.
          Turn timing off if you solved this mock on a custom clock.
        </p>
        <pre className="mt-4 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-xs leading-relaxed">
          {report}
        </pre>
      </section>

      <section id="tailored" className="rounded-2xl border border-border p-5">
        <h2 className="text-lg font-semibold">Get Tailored Practice</h2>
        <p className="mt-1 text-sm text-muted">
          Misses from this mock. Build the next {SECTION_META[attempt.section].short}{" "}
          mock in the Opera extension — used questions stay skipped on Emre OS.
        </p>
        {misses.length === 0 ? (
          <p className="mt-3 text-sm">No misses on this filtered set.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {misses.map((row) => (
              <li key={row.key}>
                Module {row.module} Q{row.index + 1} · {row.question.skill} ·{" "}
                {row.question.difficulty} · you {row.chosen}, correct {row.correct}
              </li>
            ))}
          </ul>
        )}
        <a
          href={SECTION_META[attempt.section].khanUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
        >
          Practice on Khan Academy
        </a>
      </section>

      {reviewRow ? (
        <ReviewModal
          attemptTitle={`${attempt.title} — ${date.toLocaleDateString()}`}
          row={reviewRow}
          showExplain={showCorrect}
          onShowExplain={setShowCorrect}
          onClose={() => setReview(null)}
          onPrev={() => setReview((i) => (i == null ? 0 : Math.max(0, i - 1)))}
          onNext={() =>
            setReview((i) =>
              i == null ? 0 : Math.min(filtered.length - 1, i + 1),
            )
          }
        />
      ) : null}
    </div>
  );
}

function Rich({ html }: { html: string }) {
  if (!html) return null;
  if (/<[a-z][\s\S]*>/i.test(html)) {
    return (
      <div
        className="mt-2 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{html}</div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-[#e8f1fb] px-4 py-6 text-center text-[#123] dark:bg-surface-2 dark:text-foreground">
      <p className="text-4xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

function ReviewModal({
  attemptTitle,
  row,
  showExplain,
  onShowExplain,
  onClose,
  onPrev,
  onNext,
}: {
  attemptTitle: string;
  row: SatQuestionRow;
  showExplain: boolean;
  onShowExplain: (v: boolean) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close review"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-background">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{attemptTitle}</h2>
          <p className="text-xs text-muted">
            Knowledge and Skills: {row.question.domain}
            <button type="button" className="ml-3" onClick={onClose}>
              ×
            </button>
          </p>
        </header>
        <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-2">
          <div className="border-b border-border p-5 md:border-b-0 md:border-r">
            <p className="text-sm font-semibold">
              {row.sectionLabel}: Question {row.number}
            </p>
            <Rich html={(row.question.stimulus || "") + (row.question.stimulus && row.question.prompt ? "\n\n" : "") + (row.question.prompt || "")} />
            {row.question.answerOptions?.length ? (
              <ol className="mt-4 list-none space-y-1 text-sm">
                {row.question.answerOptions.map((opt) => (
                  <li key={opt.letter} className="flex gap-2">
                    <span>{opt.letter}.</span>
                    <span
                      dangerouslySetInnerHTML={{ __html: opt.content }}
                    />
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
          <div className="p-5">
            <p className="text-sm font-semibold">Answer</p>
            <div
              className={cn(
                "mt-2 rounded-md px-3 py-2 text-sm font-medium",
                row.isCorrect
                  ? "bg-success/15 text-success"
                  : "bg-danger/15 text-danger",
              )}
            >
              You selected answer {row.chosen}. The correct answer is{" "}
              {row.correct}.
            </div>
            {showExplain && row.question.rationale ? (
              <div className="mt-4 text-sm leading-relaxed">
                <p className="font-semibold">Rationale</p>
                <Rich html={row.question.rationale} />
              </div>
            ) : null}
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showExplain}
              onChange={(e) => onShowExplain(e.target.checked)}
            />
            Show correct answer and explanation
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onPrev}>
              Previous
            </Button>
            <Button onClick={onNext}>Next</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
