"use client";

import { useState } from "react";
import Link from "next/link";
import {
  User,
  Download,
  Upload,
  Bot,
  KeyRound,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { useHub } from "@/lib/store";

const AI_ROUTES = [
  "GET /api/ai/summary/today",
  "GET /api/ai/habits",
  "PATCH /api/ai/habits/log",
  "GET /api/ai/tasks",
  "POST /api/ai/tasks",
  "GET /api/ai/movies",
  "POST /api/ai/movies",
  "GET /api/ai/journal/recent",
  "POST /api/ai/journal",
  "GET /api/ai/college-counseling/context-pack",
  "GET /api/ai/analytics/last-30-days",
];

export default function SettingsPage() {
  return (
    <Hydrated>
      <Settings />
    </Hydrated>
  );
}

function Settings() {
  const { data, setProfile, reset, source, userId, lock } = useHub();
  const [name, setName] = useState(data.profile.display_name);
  const [timezone, setTimezone] = useState(data.profile.timezone);
  const [bio, setBio] = useState(data.profile.bio ?? "");
  const [saved, setSaved] = useState(false);

  async function saveProfile() {
    try {
      await setProfile({ display_name: name, timezone, bio });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      /* toast not required here; inline saved flag only on success */
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emre-hub-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile and data." />

      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
          <CardDescription>
            The hub is protected by a fixed password (`APP_PASSWORD`). There is
            no Supabase login.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void lock()}>
            Lock hub
          </Button>
          {source === "supabase" && userId && (
            <Badge variant="default" className="font-mono text-[10px]">
              hub:{userId.slice(0, 8)}…
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4 text-primary" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/Istanbul"
              />
            </div>
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => void saveProfile()}>Save profile</Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-success">
                <CheckCircle2 className="size-4" /> Saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" /> Habits
          </CardTitle>
          <CardDescription>
            Add, edit, or archive your habits on the Habits page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/habits"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Manage habits
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4 text-accent" /> Data
          </CardTitle>
          <CardDescription>
            {source === "local"
              ? "All data is stored in this browser (localStorage)."
              : "Habits, tasks, journal, movies, and goals sync to Supabase. Study, research, notes, and milestones remain local until a later migration."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportData}>
            <Download /> Export JSON
          </Button>
          <Button variant="secondary" size="sm" disabled title="Coming soon">
            <Upload /> Import (coming soon)
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (
                confirm("Reset all local data back to the sample dataset?")
              ) {
                reset();
              }
            }}
          >
            <RefreshCw /> Reset to sample data
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-4 text-primary" /> AI integration
          </CardTitle>
          <CardDescription>
            The AI assistant reads and updates selected data through secure,
            server-side API routes. Keys live only on the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5">
              <KeyRound className="size-3.5" /> AI API key
            </Label>
            <Input
              type="password"
              placeholder="Configured server-side via AI_API_KEY"
              disabled
            />
            <p className="mt-1.5 text-xs text-muted-2">
              For security, API keys are never entered or stored in the browser.
              Set <code className="text-foreground">AI_API_KEY</code> in your
              server environment.
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">
              Available AI endpoints
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AI_ROUTES.map((r) => (
                <Badge key={r} variant="default" className="font-mono">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
