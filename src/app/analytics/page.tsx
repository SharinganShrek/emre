"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  CheckCircle2,
  Clock,
  Dumbbell,
  Smile,
  Clapperboard,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { useHub } from "@/lib/store";
import {
  byWeek,
  habitCompletionByWeek,
  last30Days,
} from "@/lib/selectors";

const AXIS = { stroke: "var(--muted-2)", fontSize: 12, tickLine: false };
const TOOLTIP = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
  },
};

export default function AnalyticsPage() {
  return (
    <Hydrated>
      <Analytics />
    </Hydrated>
  );
}

function Analytics() {
  const { data } = useHub();
  const stats = last30Days(data);

  const habitWeeks = useMemo(() => habitCompletionByWeek(data, 6), [data]);
  const studyWeeks = useMemo(
    () =>
      byWeek(
        data.studySessions,
        (s) => s.session_date,
        (s) => s.duration_minutes / 60,
        6,
      ).map((w) => ({ label: w.label, value: Number(w.value.toFixed(1)) })),
    [data.studySessions],
  );
  const gymWeeks = useMemo(
    () =>
      byWeek(
        data.gymSessions,
        (g) => g.session_date,
        () => 1,
        6,
      ),
    [data.gymSessions],
  );
  const moodTrend = useMemo(
    () =>
      [...data.journal]
        .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
        .slice(-14)
        .map((j) => ({
          label: new Date(j.entry_date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          mood: j.mood,
        })),
    [data.journal],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Life stats from the last 30 days."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Habit rate"
          value={`${stats.habitCompletionPct}%`}
          icon={CheckCircle2}
          accent="text-success"
        />
        <StatCard
          label="Study"
          value={`${stats.studyHours}h`}
          icon={Clock}
          accent="text-accent"
        />
        <StatCard
          label="Gym"
          value={stats.gymSessions}
          icon={Dumbbell}
          accent="text-danger"
        />
        <StatCard
          label="Avg mood"
          value={stats.avgMood ?? "—"}
          icon={Smile}
          accent="text-warning"
        />
        <StatCard
          label="Watched"
          value={stats.moviesWatched}
          icon={Clapperboard}
          accent="text-primary"
        />
        <StatCard
          label="Books read"
          value={stats.booksRead}
          icon={BookOpen}
          accent="text-accent"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Habit completion by week (%)">
          <BarChart data={habitWeeks}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis domain={[0, 100]} {...AXIS} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="value" fill="var(--success)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Study hours by week">
          <BarChart data={studyWeeks}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="value" fill="var(--accent)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Gym sessions by week">
          <BarChart data={gymWeeks}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis allowDecimals={false} {...AXIS} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="value" fill="var(--danger)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Mood trend">
          <LineChart data={moodTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS} />
            <Tooltip {...TOOLTIP} />
            <Line
              type="monotone"
              dataKey="mood"
              stroke="var(--warning)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
