"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  GraduationCap,
  Clock,
  Trophy,
  Trash2,
  ClipboardList,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { PageNotes } from "@/components/notion/page-notes";
import { useHub } from "@/lib/store";
import { formatLongDate, todayISO } from "@/lib/utils";

const SUBJECTS = [
  "SAT Math",
  "SAT Reading",
  "SAT Vocabulary",
  "SAT Writing",
  "Other",
];

export default function StudyPage() {
  return (
    <Hydrated>
      <Study />
    </Hydrated>
  );
}

function Study() {
  const { data, add, remove } = useHub();
  const [sessionOpen, setSessionOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  const totalMinutes = data.studySessions.reduce(
    (s, x) => s + x.duration_minutes,
    0,
  );
  const tests = [...data.practiceTests].sort((a, b) =>
    a.test_date.localeCompare(b.test_date),
  );
  const latest = tests[tests.length - 1];
  const best = tests.reduce(
    (m, t) => Math.max(m, t.total_score ?? 0),
    0,
  );

  const chartData = useMemo(
    () =>
      tests.map((t) => ({
        name: new Date(t.test_date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        total: t.total_score ?? null,
        math: t.math_score ?? null,
        rw: t.reading_writing_score ?? null,
      })),
    [tests],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Hub"
        description="Track SAT study sessions and practice test progress."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setTestOpen(true)}>
              <ClipboardList /> Log test
            </Button>
            <Button size="sm" onClick={() => setSessionOpen(true)}>
              <Plus /> Study session
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total study"
          value={`${(totalMinutes / 60).toFixed(1)}h`}
          hint={`${data.studySessions.length} sessions`}
          icon={Clock}
          accent="text-accent"
        />
        <StatCard
          label="Latest score"
          value={latest?.total_score ?? "—"}
          hint={latest ? formatLongDate(latest.test_date) : "No tests yet"}
          icon={GraduationCap}
          accent="text-primary"
        />
        <StatCard
          label="Best score"
          value={best || "—"}
          hint="All practice tests"
          icon={Trophy}
          accent="text-warning"
        />
        <StatCard
          label="Practice tests"
          value={tests.length}
          hint="Logged"
          icon={ClipboardList}
          accent="text-success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Practice test scores</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No practice tests yet"
              description="Log a practice test to see your score trend."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-2)"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-2)"
                    fontSize={12}
                    tickLine={false}
                    domain={[1000, 1600]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent study sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {data.studySessions.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No sessions logged"
                description="Add a study session to start tracking."
              />
            ) : (
              <ul className="space-y-2">
                {[...data.studySessions]
                  .sort((a, b) => b.session_date.localeCompare(a.session_date))
                  .slice(0, 8)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.subject}
                        </p>
                        <p className="truncate text-xs text-muted-2">
                          {s.session_date}
                          {s.notes ? ` · ${s.notes}` : ""}
                        </p>
                      </div>
                      <Badge variant="primary">{s.duration_minutes}m</Badge>
                      <button
                        onClick={() => remove("studySessions", s.id)}
                        className="text-muted-2 hover:text-danger"
                        aria-label="Delete session"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Practice tests</CardTitle>
          </CardHeader>
          <CardContent>
            {tests.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No tests yet"
                description="Log a full-length practice test."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-2">
                      <th className="pb-2 font-medium">Test</th>
                      <th className="pb-2 font-medium">Math</th>
                      <th className="pb-2 font-medium">R&amp;W</th>
                      <th className="pb-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...tests].reverse().map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 pr-2">{t.test_name}</td>
                        <td className="py-2">{t.math_score ?? "—"}</td>
                        <td className="py-2">{t.reading_writing_score ?? "—"}</td>
                        <td className="py-2 font-semibold">
                          {t.total_score ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PageNotes
        storageKey="emre-hub:notes:study"
        title="Weak topics & vocabulary"
        initialBlocks={[
          { id: "s1", type: "h2", text: "Weak topics" },
          { id: "s2", type: "todo", text: "Circle theorems", checked: false },
          { id: "s3", type: "todo", text: "Comma splices", checked: false },
          { id: "s4", type: "h2", text: "Vocabulary to review" },
          { id: "s5", type: "bullet", text: "Ephemeral, Ubiquitous, Pragmatic" },
        ]}
      />

      <SessionDialog
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onSave={(v) => {
          add("studySessions", {
            user_id: data.profile.user_id,
            subject: v.subject,
            duration_minutes: v.duration,
            session_date: v.date,
            notes: v.notes || null,
          });
          setSessionOpen(false);
        }}
      />
      <TestDialog
        open={testOpen}
        onClose={() => setTestOpen(false)}
        onSave={(v) => {
          add("practiceTests", {
            user_id: data.profile.user_id,
            test_name: v.name,
            test_date: v.date,
            math_score: v.math,
            reading_writing_score: v.rw,
            total_score: (v.math ?? 0) + (v.rw ?? 0) || null,
            notes: v.notes || null,
          });
          setTestOpen(false);
        }}
      />
    </div>
  );
}

function SessionDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: {
    subject: string;
    duration: number;
    date: string;
    notes: string;
  }) => void;
}) {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [duration, setDuration] = useState(45);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSubject(SUBJECTS[0]);
      setDuration(45);
      setDate(todayISO());
      setNotes("");
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Log study session">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Subject</Label>
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Duration (min)</Label>
            <Input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
            />
          </div>
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you cover?"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (duration <= 0) return setError("Duration must be positive.");
              onSave({ subject, duration, date, notes });
            }}
          >
            Save session
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function TestDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: {
    name: string;
    date: string;
    math: number | null;
    rw: number | null;
    notes: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [math, setMath] = useState(700);
  const [rw, setRw] = useState(700);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDate(todayISO());
      setMath(700);
      setRw(700);
      setNotes("");
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Log practice test">
      <div className="space-y-3">
        <div>
          <Label>Test name</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="College Board Practice 4"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Math (200–800)</Label>
            <Input
              type="number"
              min={200}
              max={800}
              value={math}
              onChange={(e) => setMath(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Reading &amp; Writing</Label>
            <Input
              type="number"
              min={200}
              max={800}
              value={rw}
              onChange={(e) => setRw(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reflections"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return setError("Test name is required.");
              onSave({ name: name.trim(), date, math, rw, notes });
            }}
          >
            Save test
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
