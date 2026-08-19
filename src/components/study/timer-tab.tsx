"use client";

import { Pause, Play, Plus, Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { cn, uid } from "@/lib/utils";
import {
  YPT_PALETTE,
  ddayOffset,
  formatDday,
  formatHMS,
  sessionMs,
} from "@/lib/study/ypt";
import type { YptStudy } from "@/lib/study/use-ypt";

export function TimerTab({ study }: { study: YptStudy }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dday = ddayOffset(study.settings.ddayDate, study.today);
  const dateLabel = new Date(`${study.today}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: "long", month: "long", day: "numeric" },
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex w-full items-center justify-between">
        <div>
          <p className="text-sm text-muted">{dateLabel}</p>
          {dday != null && (
            <p className="mt-0.5 text-xs font-medium text-teal-400">
              {study.settings.ddayLabel || "Exam"} {formatDday(dday)}
            </p>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Study settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings />
        </Button>
      </div>

      <GoalRing>
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-2">
          {study.running ? study.activeSubject?.name ?? "Studying" : "Today"}
        </p>
        <p className="mt-1 font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
          {formatHMS(study.todayMs)}
        </p>
        {!study.running && study.restMs > 0 ? (
          <p className="mt-2 text-xs text-muted-2">
            Rest {formatHMS(study.restMs)}
          </p>
        ) : null}
      </GoalRing>

      <button
        type="button"
        onClick={() => study.toggle()}
        aria-label={study.running ? "Pause" : "Start"}
        className={cn(
          "flex size-16 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
          study.running
            ? "bg-warning text-background"
            : "bg-teal-400 text-background",
        )}
      >
        {study.running ? (
          <Pause className="size-7 fill-current" />
        ) : (
          <Play className="size-7 fill-current pl-0.5" />
        )}
      </button>

      <ul className="w-full space-y-1.5">
        {study.settings.subjects.map((subject) => {
          const saved = study.sessions
            .filter(
              (s) =>
                s.session_date === study.today && s.subject === subject.name,
            )
            .reduce((sum, s) => sum + sessionMs(s), 0);
          const live =
            study.running && study.activeSubject?.id === subject.id
              ? study.liveMs
              : 0;
          const active = study.activeSubject?.id === subject.id;
          return (
            <li key={subject.id}>
              <div
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  active ? "bg-surface-2" : "hover:bg-surface-2/70",
                )}
              >
                <button
                  type="button"
                  onClick={() => study.selectSubject(subject.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {subject.name}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {formatHMS(saved + live)}
                  </span>
                </button>
                {study.running && active ? (
                  <span className="size-2 shrink-0 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf]" />
                ) : (
                  <button
                    type="button"
                    aria-label={`Start ${subject.name}`}
                    onClick={() => study.play(subject.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-2 hover:bg-background hover:text-foreground"
                  >
                    <Play className="size-3.5 fill-current" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        study={study}
      />
    </div>
  );
}

function GoalRing({ children }: { children: ReactNode }) {
  const r = 104;
  return (
    <div className="relative size-64 sm:size-72">
      <svg viewBox="0 0 240 240" className="size-full -rotate-90">
        <circle
          cx="120"
          cy="120"
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
        />
        <circle
          cx="120"
          cy="120"
          r={r}
          fill="none"
          stroke="#2dd4bf"
          strokeWidth="10"
          opacity={0.85}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        {children}
      </div>
    </div>
  );
}

function SettingsDialog({
  open,
  onClose,
  study,
}: {
  open: boolean;
  onClose: () => void;
  study: YptStudy;
}) {
  const [newName, setNewName] = useState("");

  return (
    <Dialog open={open} onClose={onClose} title="Study settings">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>D-Day label</Label>
            <Input
              value={study.settings.ddayLabel}
              onChange={(e) =>
                study.setSettings({ ddayLabel: e.target.value })
              }
              placeholder="SAT"
            />
          </div>
          <div>
            <Label>D-Day date</Label>
            <Input
              type="date"
              value={study.settings.ddayDate}
              onChange={(e) =>
                study.setSettings({ ddayDate: e.target.value })
              }
            />
          </div>
        </div>
        <div>
          <Label>Subjects</Label>
          <ul className="space-y-2">
            {study.settings.subjects.map((subject) => (
              <li key={subject.id} className="flex items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: subject.color }}
                />
                <Input
                  value={subject.name}
                  onChange={(e) =>
                    study.setSettings((prev) => ({
                      ...prev,
                      subjects: prev.subjects.map((s) =>
                        s.id === subject.id
                          ? { ...s, name: e.target.value }
                          : s,
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="text-xs text-muted-2 hover:text-danger"
                  disabled={study.settings.subjects.length <= 1}
                  onClick={() =>
                    study.setSettings((prev) => ({
                      ...prev,
                      subjects: prev.subjects.filter((s) => s.id !== subject.id),
                    }))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newName.trim();
              if (!name) return;
              study.setSettings((prev) => ({
                ...prev,
                subjects: [
                  ...prev.subjects,
                  {
                    id: uid("subj"),
                    name,
                    color: YPT_PALETTE[prev.subjects.length % YPT_PALETTE.length],
                  },
                ],
              }));
              setNewName("");
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add subject"
            />
            <Button type="submit" size="sm" variant="secondary">
              <Plus />
            </Button>
          </form>
        </div>
      </div>
    </Dialog>
  );
}
