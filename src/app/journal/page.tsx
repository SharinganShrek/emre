"use client";

import { useState } from "react";
import { NotebookPen, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { useHub } from "@/lib/store";
import { formatLongDate, todayISO } from "@/lib/utils";

const MOODS = ["😞", "🙁", "😐", "🙂", "😄"];
const MOOD_LABEL = ["Rough", "Low", "Okay", "Good", "Great"];

export default function JournalPage() {
  return (
    <Hydrated>
      <Journal />
    </Hydrated>
  );
}

function Journal() {
  const { data, add, remove } = useHub();
  const [mood, setMood] = useState(4);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const entries = [...data.journal].sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date),
  );

  function save() {
    if (!content.trim()) return setError("Write something first.");
    add("journal", {
      user_id: data.profile.user_id,
      entry_date: todayISO(),
      mood,
      content: content.trim(),
    });
    setContent("");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal"
        description="A daily log of how things are going."
      />

      <Card>
        <CardHeader>
          <CardTitle>New entry · {formatLongDate()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Mood</Label>
            <div className="flex gap-2">
              {MOODS.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setMood(i + 1)}
                  className={`flex size-10 items-center justify-center rounded-lg text-xl transition-colors ${
                    mood === i + 1
                      ? "bg-primary/15 ring-2 ring-primary"
                      : "bg-surface-2 hover:bg-card-hover"
                  }`}
                  title={MOOD_LABEL[i]}
                  aria-label={MOOD_LABEL[i]}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Entry</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="How did today go? What are you grateful for?"
              className="min-h-[120px]"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={save}>Save entry</Button>
          </div>
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No journal entries"
          description="Your reflections will appear here."
        />
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl" title={MOOD_LABEL[e.mood - 1]}>
                    {MOODS[e.mood - 1]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-2">
                      {formatLongDate(e.entry_date)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {e.content}
                    </p>
                  </div>
                  <button
                    onClick={() => remove("journal", e.id)}
                    className="text-muted-2 hover:text-danger"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
