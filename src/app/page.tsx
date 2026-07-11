"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Target,
  GraduationCap,
  CalendarClock,
  Plus,
  NotebookPen,
  StickyNote,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { HabitChecklist } from "@/components/habits/habit-checklist";
import { useHub } from "@/lib/store";
import { useQuickAdd } from "@/components/quick-add";
import {
  todayCompletion,
  upcomingDeadlines,
  last30Days,
} from "@/lib/selectors";
import { daysBetween, formatLongDate, todayISO } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <Hydrated>
      <Dashboard />
    </Hydrated>
  );
}

function Dashboard() {
  const { data } = useHub();
  const { open } = useQuickAdd();
  const completion = todayCompletion(data);
  const deadlines = upcomingDeadlines(data, 14);
  const stats = last30Days(data);
  const activeGoals = data.goals.filter((g) => g.status === "active");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${data.profile.display_name}`}
        description={formatLongDate()}
      />

      {/* Quick add buttons */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => open("task")}>
          <Plus /> Add task
        </Button>
        <Button size="sm" variant="secondary" onClick={() => open("journal")}>
          <NotebookPen /> Journal
        </Button>
        <Button size="sm" variant="secondary" onClick={() => open("note")}>
          <StickyNote /> Note
        </Button>
        <Link href="/study" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <GraduationCap /> Log study
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's habits"
          value={`${completion.pct}%`}
          hint={`${completion.done}/${completion.total} completed`}
          icon={CheckCircle2}
          accent="text-success"
        />
        <StatCard
          label="Active goals"
          value={activeGoals.length}
          hint="In progress"
          icon={Target}
          accent="text-primary"
        />
        <StatCard
          label="Study (30d)"
          value={`${stats.studyHours}h`}
          hint={`${stats.gymSessions} gym sessions`}
          icon={GraduationCap}
          accent="text-accent"
        />
        <StatCard
          label="Upcoming"
          value={deadlines.length}
          hint="Deadlines in 14 days"
          icon={CalendarClock}
          accent="text-warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Habit checklist */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Daily habits</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                })}
              </p>
            </div>
            <Link
              href="/habits"
              className="text-xs text-primary hover:underline"
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                <span>Completion</span>
                <span>{completion.pct}%</span>
              </div>
              <Progress
                value={completion.pct}
                barClassName="bg-success"
              />
            </div>
            <HabitChecklist />
          </CardContent>
        </Card>

        {/* Upcoming deadlines */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nothing due soon"
                description="Deadlines in the next two weeks will show up here."
              />
            ) : (
              <ul className="space-y-2">
                {deadlines.slice(0, 6).map((d) => {
                  const inDays = daysBetween(todayISO(), d.date);
                  return (
                    <li
                      key={`${d.kind}-${d.id}`}
                      className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{d.title}</p>
                        <p className="text-xs text-muted-2">
                          {d.kind === "task" ? "Task" : "Goal"}
                          {d.meta ? ` · ${d.meta}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          inDays <= 1
                            ? "danger"
                            : inDays <= 5
                              ? "warning"
                              : "default"
                        }
                      >
                        {inDays === 0
                          ? "Today"
                          : inDays === 1
                            ? "Tomorrow"
                            : `${inDays}d`}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Active goals</CardTitle>
          <Link href="/goals" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeGoals.slice(0, 4).map((g) => (
            <div key={g.id}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm">{g.title}</span>
                <span className="text-xs text-muted">{g.progress}%</span>
              </div>
              <Progress value={g.progress} />
            </div>
          ))}
          {activeGoals.length === 0 && (
            <Link href="/goals">
              <Button variant="secondary" size="sm">
                Set your first goal <ArrowRight />
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
