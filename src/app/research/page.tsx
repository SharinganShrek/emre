"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  FlaskConical,
  FileText,
  Beaker,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { PageNotes } from "@/components/notion/page-notes";
import { useHub } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { BadgeProps } from "@/components/ui/badge";

const PAPER_STATUS: Record<string, BadgeProps["variant"]> = {
  to_read: "default",
  reading: "warning",
  read: "success",
};
const EXP_STATUS: Record<string, BadgeProps["variant"]> = {
  planned: "default",
  running: "warning",
  done: "success",
  failed: "danger",
};

export default function ResearchPage() {
  return (
    <Hydrated>
      <Research />
    </Hydrated>
  );
}

function Research() {
  const { data, add } = useHub();
  const [projectOpen, setProjectOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    data.researchProjects[0]?.id ?? null,
  );

  const selected =
    data.researchProjects.find((p) => p.id === selectedId) ??
    data.researchProjects[0] ??
    null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research Hub"
        description="Projects, papers, experiments, and notes."
        actions={
          <Button size="sm" onClick={() => setProjectOpen(true)}>
            <Plus /> New project
          </Button>
        }
      />

      {data.researchProjects.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No research projects"
          description="Create a project to organize papers and experiments."
          action={
            <Button size="sm" onClick={() => setProjectOpen(true)}>
              <Plus /> New project
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {data.researchProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  selected?.id === p.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface-2 text-muted hover:text-foreground",
                )}
              >
                {p.title}
              </button>
            ))}
          </div>

          {selected && <ProjectDetail projectId={selected.id} />}
        </>
      )}

      <ProjectDialog
        open={projectOpen}
        onClose={() => setProjectOpen(false)}
        onSave={(v) => {
          void (async () => {
            const created = await add("researchProjects", {
              user_id: data.profile.user_id,
              title: v.title,
              description: v.description || null,
              status: "planning",
            });
            setSelectedId(created.id);
            setProjectOpen(false);
          })();
        }}
      />
    </div>
  );
}

function ProjectDetail({ projectId }: { projectId: string }) {
  const { data, add, update, remove } = useHub();
  const project = data.researchProjects.find((p) => p.id === projectId)!;
  const papers = data.researchPapers.filter((p) => p.project_id === projectId);
  const experiments = data.researchExperiments.filter(
    (e) => e.project_id === projectId,
  );

  const [paperTitle, setPaperTitle] = useState("");
  const [paperUrl, setPaperUrl] = useState("");
  const [expName, setExpName] = useState("");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base">{project.title}</CardTitle>
            {project.description && (
              <p className="mt-1 text-sm text-muted">{project.description}</p>
            )}
          </div>
          <Select
            value={project.status}
            onChange={(e) =>
              update("researchProjects", project.id, {
                status: e.target
                  .value as typeof project.status,
              })
            }
            className="h-8 w-32"
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="done">Done</option>
          </Select>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" /> Papers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {papers.length === 0 && (
              <p className="text-sm text-muted">No papers yet.</p>
            )}
            {papers.map((p) => (
              <div
                key={p.id}
                className="rounded-lg bg-surface-2 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.title}</p>
                    {p.authors && (
                      <p className="text-xs text-muted-2">{p.authors}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-2 hover:text-primary"
                        aria-label="Open paper"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => remove("researchPapers", p.id)}
                      className="text-muted-2 hover:text-danger"
                      aria-label="Delete paper"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-1">
                  {(["to_read", "reading", "read"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        update("researchPapers", p.id, { status: s })
                      }
                    >
                      <Badge
                        variant={
                          p.status === s ? PAPER_STATUS[s] : "default"
                        }
                        className={cn(p.status !== s && "opacity-50")}
                      >
                        {s.replace("_", " ")}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!paperTitle.trim()) return;
                add("researchPapers", {
                  user_id: data.profile.user_id,
                  project_id: projectId,
                  title: paperTitle.trim(),
                  authors: null,
                  url: paperUrl || null,
                  status: "to_read",
                  notes: null,
                });
                setPaperTitle("");
                setPaperUrl("");
              }}
              className="space-y-2 pt-1"
            >
              <Input
                value={paperTitle}
                onChange={(e) => setPaperTitle(e.target.value)}
                placeholder="Paper title"
                className="h-8 text-xs"
              />
              <div className="flex gap-2">
                <Input
                  value={paperUrl}
                  onChange={(e) => setPaperUrl(e.target.value)}
                  placeholder="https://arxiv.org/…"
                  className="h-8 text-xs"
                />
                <Button size="sm" type="submit" variant="secondary">
                  Add
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Beaker className="size-4 text-accent" /> Experiments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {experiments.length === 0 && (
              <p className="text-sm text-muted">No experiments yet.</p>
            )}
            {experiments.map((ex) => (
              <div key={ex.id} className="rounded-lg bg-surface-2 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{ex.name}</p>
                  <button
                    onClick={() => remove("researchExperiments", ex.id)}
                    className="text-muted-2 hover:text-danger"
                    aria-label="Delete experiment"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {ex.hypothesis && (
                  <p className="mt-0.5 text-xs text-muted-2">
                    {ex.hypothesis}
                  </p>
                )}
                {ex.result && (
                  <p className="mt-0.5 text-xs text-success">{ex.result}</p>
                )}
                <div className="mt-1.5 flex gap-1">
                  {(["planned", "running", "done", "failed"] as const).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() =>
                          update("researchExperiments", ex.id, { status: s })
                        }
                      >
                        <Badge
                          variant={ex.status === s ? EXP_STATUS[s] : "default"}
                          className={cn(ex.status !== s && "opacity-50")}
                        >
                          {s}
                        </Badge>
                      </button>
                    ),
                  )}
                </div>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!expName.trim()) return;
                add("researchExperiments", {
                  user_id: data.profile.user_id,
                  project_id: projectId,
                  name: expName.trim(),
                  hypothesis: null,
                  result: null,
                  status: "planned",
                  run_date: null,
                });
                setExpName("");
              }}
              className="flex gap-2 pt-1"
            >
              <Input
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                placeholder="Experiment name"
                className="h-8 text-xs"
              />
              <Button size="sm" type="submit" variant="secondary">
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <PageNotes
        storageKey={`emre-hub:notes:research:${projectId}`}
        title="Project notes"
        initialBlocks={[
          { id: "r1", type: "h2", text: "Open questions" },
          { id: "r2", type: "bullet", text: "Which loss function generalizes best?" },
          { id: "r3", type: "h2", text: "TODO" },
          { id: "r4", type: "todo", text: "Write related work section", checked: false },
        ]}
      />
    </div>
  );
}

function ProjectDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: { title: string; description: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="New research project">
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lung CT Segmentation Research"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!title.trim()) return setError("Title is required.");
              onSave({ title: title.trim(), description });
            }}
          >
            Create project
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
