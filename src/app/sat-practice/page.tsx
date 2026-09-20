"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import type {
  SatPracticeAttemptSummary,
  SatPracticeSettings,
} from "@/lib/sat-practice/types";
import { isFullSat, SECTION_META } from "@/lib/sat-practice/types";
import { cn } from "@/lib/utils";

type Payload = {
  attempts: SatPracticeAttemptSummary[];
  settings: SatPracticeSettings;
};

export default function SatPracticePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/sat-practice");
    const json = (await res.json()) as Payload & { error?: string };
    if (!res.ok) throw new Error(json.error || "Failed to load");
    setData(json);
    setSelectedId((cur) => cur || json.attempts[0]?.id || null);
  }, []);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const selected = useMemo(
    () => data?.attempts.find((a) => a.id === selectedId) || data?.attempts[0],
    [data, selectedId],
  );

  async function generateToken() {
    setBusy(true);
    try {
      const res = await fetch("/api/sat-practice/connect", { method: "POST" });
      const json = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !json.token) throw new Error(json.error || "Could not create token");
      setToken(json.token);
      toast.success("Connect token created. Paste it into the Opera extension.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Token failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">SAT Practice</h1>
        <p className="text-sm text-danger">{error}</p>
        <p className="text-sm text-muted">
          If this persists after a reload, the SAT Practice API is still
          failing — check the red message above.
        </p>
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-muted">Loading SAT practice…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        <section className="flex flex-col justify-center overflow-hidden rounded-2xl bg-[#1473e6] px-6 py-6 text-white sm:px-7">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            My Practice
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/90">
            Review mocks and official Bluebook tests, then drill the skills that
            still cost you points.
          </p>
        </section>
        <ConnectPanel
          settings={data.settings}
          token={token}
          busy={busy}
          onGenerate={generateToken}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold">SAT Practice Tests</h2>
        <p className="mt-1 text-sm text-muted">
          QBank R&amp;W and Math mocks stay separate. Official Bluebook practice
          tests import as one 1600 SAT.
        </p>
      </div>

      {data.attempts.length === 0 ? (
        <p className="text-sm text-muted">
          No tests yet. Connect the Opera extension to build a QBank mock or
          import official Bluebook scores.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {data.attempts.map((attempt) => (
            <ScoreCard
              key={attempt.id}
              attempt={attempt}
              selected={attempt.id === selected?.id}
              onSelect={() => setSelectedId(attempt.id)}
            />
          ))}
        </div>
      )}

      {selected?.status === "completed" && selected.domain_stats?.length ? (
        <DomainBars attempt={selected} />
      ) : null}
    </div>
  );
}

function ConnectPanel({
  settings,
  token,
  busy,
  onGenerate,
}: {
  settings: SatPracticeSettings;
  token: string | null;
  busy: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm font-medium">Opera extension connection</p>
      <p className="mt-1 text-sm text-muted">
        Connect token is only for the extension. Custom GPT uses its own key.
        Used-question history stays here ({settings.used_external_id_count} IDs,{" "}
        {settings.used_content_hash_count} hashes).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={onGenerate} disabled={busy} size="sm">
          {busy ? <Loader2 className="animate-spin" /> : null}
          {settings.has_ingest_token ? "Replace connect token" : "Generate connect token"}
        </Button>
        {settings.has_ingest_token && !token ? (
          <span className="text-xs text-muted">A token is already saved. Generate again only if you lost it.</span>
        ) : null}
      </div>
      {token ? (
        <p className="mt-3 break-all rounded-lg bg-surface-2 p-3 font-mono text-xs">
          {token}
        </p>
      ) : null}
    </div>
  );
}

function ScoreCard({
  attempt,
  selected,
  onSelect,
}: {
  attempt: SatPracticeAttemptSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = SECTION_META[attempt.section];
  const official = isFullSat(attempt);
  const date = new Date(attempt.completed_at || attempt.created_at);
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const completed = attempt.status === "completed";
  const totalScore = official
    ? (attempt.official_total ?? attempt.scaled_estimated)
    : attempt.scaled_estimated;
  const rwScore = official
    ? attempt.official_rw
    : attempt.section === "rw"
      ? attempt.scaled_estimated
      : null;
  const mathScore = official
    ? attempt.official_math
    : attempt.section === "math"
      ? attempt.scaled_estimated
      : null;

  return (
    <article
      className={cn(
        "w-[280px] shrink-0 overflow-hidden rounded-xl border bg-card",
        selected ? "border-primary" : "border-border",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-center justify-between bg-[#0b3d91] px-4 py-2 text-white">
          <span className="text-sm font-bold tracking-wide">SAT</span>
          {attempt.has_html ? (
            <a
              href={`/api/sat-practice/${attempt.id}/html`}
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1 hover:bg-white/10"
              aria-label="Download HTML"
            >
              <Download className="size-4" />
            </a>
          ) : (
            <span className="size-4" />
          )}
        </div>
      </button>
      {completed ? (
        <Link href={`/sat-practice/${attempt.id}`} className="block">
          <div className="flex items-baseline justify-between bg-[#1473e6] px-4 py-2 text-white">
            <span className="text-xs font-bold uppercase">{attempt.title}</span>
            <span className="text-[11px] opacity-90">{dateLabel}</span>
          </div>
          <div className="px-4 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {official ? "Total Score" : "Estimated section score"}
            </p>
            <p className="mt-1 text-5xl font-semibold tabular-nums">
              {totalScore ?? "—"}
            </p>
            <p className="text-[11px] text-muted-2">
              {official ? "400-1600" : `200-800 · ${meta.short}`}
              {official ? " · official" : ""}
            </p>
            <p className="mt-1 text-xs text-muted">
              {attempt.raw_correct} / {attempt.raw_total} correct
            </p>
          </div>
        </Link>
      ) : (
        <div>
          <div className="flex items-baseline justify-between bg-[#1473e6] px-4 py-2 text-white">
            <span className="text-xs font-bold uppercase">{attempt.title}</span>
            <span className="text-[11px] opacity-90">{dateLabel}</span>
          </div>
          <div className="px-4 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {attempt.status.replace("_", " ")}
            </p>
            <p className="mt-1 text-5xl font-semibold tabular-nums">—</p>
            <p className="text-[11px] text-muted-2">
              {official ? "400-1600" : `200-800 · ${meta.short}`}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-2 border-t border-border px-4 py-3 text-sm">
        <Row
          label="Reading and Writing"
          hint="200-800"
          value={
            completed && rwScore != null ? String(rwScore) : "—"
          }
        />
        <Row
          label="Math"
          hint="200-800"
          value={
            completed && mathScore != null ? String(mathScore) : "—"
          }
        />
      </div>
    </article>
  );
}

function Row({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p>{label}</p>
        <p className="text-[11px] text-muted-2">{hint}</p>
      </div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DomainBars({ attempt }: { attempt: SatPracticeAttemptSummary }) {
  return (
    <section>
      <h3 className="text-lg font-semibold">Knowledge and Skills</h3>
      <p className="mt-1 text-sm text-muted">
        Seven bars follow the SAT practice report: Easy 1–3, Medium 4–5, Hard 6–7.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(attempt.domain_stats || []).map((row) => (
          <div key={row.domain} className="rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{row.domain}</p>
              <p className="text-xs text-muted">
                {row.correct}/{row.total}
              </p>
            </div>
            <div className="mt-3 flex gap-1">
              {Array.from({ length: 7 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 flex-1 rounded-sm",
                    i < row.bars ? "bg-primary" : "bg-surface-2",
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
