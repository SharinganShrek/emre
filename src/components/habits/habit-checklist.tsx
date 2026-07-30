"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useHub } from "@/lib/store";
import { toast } from "@/lib/toast";
import { activeHabits, habitStreak, isHabitDone } from "@/lib/selectors";
import { cn, todayISO } from "@/lib/utils";

export function HabitChecklist({
  date,
  showStreak = true,
}: {
  date?: string;
  showStreak?: boolean;
}) {
  const { data, toggleHabit } = useHub();
  const day = date ?? todayISO();
  const habits = activeHabits(data);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (habits.length === 0) {
    return (
      <p className="py-4 text-sm text-muted">
        No active habits yet. Add some on the Habits page.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {habits.map((habit) => {
        const done = isHabitDone(data, habit.id, day);
        const streak = showStreak ? habitStreak(data, habit.id) : 0;
        return (
          <li
            key={habit.id}
            className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <Checkbox
              checked={done}
              color={habit.color}
              label={habit.name}
              disabled={busyId === habit.id}
              onChange={() => {
                void (async () => {
                  setBusyId(habit.id);
                  try {
                    await toggleHabit(habit.id, day);
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Could not update habit",
                    );
                  } finally {
                    setBusyId(null);
                  }
                })();
              }}
            />
            <span
              className={cn(
                "flex-1 text-sm",
                done ? "text-muted line-through" : "text-foreground",
              )}
            >
              {habit.name}
            </span>
            {showStreak && streak > 0 && (
              <Badge variant="warning" className="gap-1">
                <Flame className="size-3" />
                {streak}
              </Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
