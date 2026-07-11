# Emre — Personal Operating System

A personal life dashboard to track **habits, calendar, goals, study, research,
fitness, movies, books, journal, and notes** — with an architecture designed to
later connect to an **AI assistant** through secure, server-side API routes.

Built with **Next.js (App Router) · TypeScript · Tailwind CSS · Supabase**.
Dark-first, responsive, and component-driven.

---

## ✨ Features

- **Dashboard** — today's date, daily habit checklist, completion %, upcoming
  deadlines, quick-add buttons.
- **Calendar** — monthly view with per-day habit completion and a day detail
  panel.
- **Habits** — add / edit / archive habits, streaks, and a 21-day completion
  heatmap. Ships with SAT Vocabulary, SAT Reading, SAT Math, Skincare, Gym, and
  Sleep goal.
- **Goals** — long-term goals with progress bars, milestones, and deadlines.
- **Study Hub** — study sessions, practice-test score tracking with a trend
  chart, and an editable "weak topics & vocabulary" area.
- **Research Hub** — projects, papers, experiments, and notes (includes the
  sample project *Lung CT Segmentation Research*).
- **Fitness** — gym sessions with per-session exercises and consistency stats.
- **Movies & Anime** — watched list with status, 0–10 rating, and reviews.
- **Books** — reading list with status, rating, and reviews.
- **Journal** — daily entries with mood tracking.
- **Notes / Second Brain** — notes with title, body, tags, categories, pinning,
  and search.
- **Analytics** — habit completion, study hours/week, gym/week, mood trend, and
  media counts.
- **Settings** — profile, habit management, data export, and AI integration
  settings.
- **Notion-style editing** — every non-dashboard page has an editable,
  formattable block area (headings, text, to-dos, bullets, quotes, dividers)
  with Markdown-style shortcuts (`# `, `- `, `[] `, `> `, `---`).

---

## 🧱 Tech stack & architecture

```
src/
  app/                     # App Router pages + API routes
    (pages)/               # dashboard, habits, calendar, goals, study, …
    api/ai/                # secure AI endpoints
  components/
    ui/                    # reusable primitives (Button, Card, Dialog, …)
    layout/                # sidebar, app shell, theme
    notion/                # block editor + editable page section
    habits/                # habit checklist
  lib/
    types.ts               # domain types (mirror the DB schema)
    store.tsx              # client store (localStorage) — the MVP data layer
    seed.ts                # in-browser sample dataset
    selectors.ts           # derived data (streaks, completion, analytics)
    validation.ts          # zod schemas (forms + AI routes)
    supabase/              # browser / server / admin clients
    ai/                    # permission layer, audit logging, responses
supabase/
  schema.sql               # full Postgres schema (tables, indexes, RLS)
  seed.sql                 # sample data for a Supabase user
```

### Two data modes

1. **Local mode (default, zero-config).** The app runs entirely in the browser
   using a typed store persisted to `localStorage`, pre-loaded with a realistic
   sample dataset (`src/lib/seed.ts`). No Supabase or env vars required — great
   for development and demos.
2. **Supabase mode (persistence + AI).** Apply `supabase/schema.sql`, set the
   env vars, and the secure AI API routes read/write real Postgres data. The
   Supabase clients are already wired (`src/lib/supabase/*`).

> The UI store and the database schema share the same TypeScript types
> (`src/lib/types.ts`), so wiring pages to Supabase later is straightforward.

---

## 🚀 Getting started

### Prerequisites

- Node.js 18+ (tested on Node 22)
- npm

### Install & run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The app works immediately in **local mode** with
sample data.

> **Note about restricted networks:** if your network/proxy blocks
> `registry.npmjs.org` (symptoms: `UNABLE_TO_VERIFY_LEAF_SIGNATURE` or
> `403 Forbidden` during install), point npm at a public mirror:
>
> ```bash
> npm config set registry https://registry.npmmirror.com
> # If a TLS-intercepting proxy is present you may also need your corporate CA:
> #   npm config set cafile /path/to/corp-ca.pem
> # (avoid `strict-ssl false` outside trusted local dev)
> ```

### Build

```bash
npm run build   # production build + type check
npm run lint     # eslint
```

---

## 🔐 Environment variables

Copy `.env.example` to `.env.local` and fill in values (only needed for
Supabase + AI features):

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS — used *only* by the AI layer |
| `AI_API_KEY` | server only | Shared secret the assistant sends as a Bearer token |
| `AI_USER_ID` | server only | The single user id AI routes may act on (MVP is single-user) |

**Never expose `SUPABASE_SERVICE_ROLE_KEY` or `AI_API_KEY` to the client.** They
are read only in server code (`src/lib/supabase/admin.ts`, `src/lib/ai/*`) and
guarded with `import "server-only"`.

---

## 🗄️ Database schema (Supabase / Postgres)

Apply the schema in the Supabase SQL editor (or `supabase db push`):

```
supabase/schema.sql   # tables, indexes, triggers, RLS policies
supabase/seed.sql     # optional sample data (replace the user id first)
```

Tables: `profiles`, `habits`, `habit_logs`, `tasks`, `goals`,
`goal_milestones`, `study_sessions`, `practice_tests`, `research_projects`,
`research_papers`, `research_experiments`, `gym_sessions`, `gym_exercises`,
`movies`, `books`, `journal_entries`, `notes`, `ai_audit_logs`.

Every table has `id`, `created_at`, `updated_at` (auto-maintained by a trigger),
and — where relevant — a `user_id` referencing `auth.users`.

### Row Level Security assumptions

- **RLS is enabled on every table.** Each has an `owner_all` policy:
  `auth.uid() = user_id` for both `using` and `with check`. A signed-in user can
  only read/write their own rows.
- The **anon key** (browser/server SSR clients) always operates *as the user*,
  so RLS is enforced.
- The **service role** bypasses RLS and is used **only** by the AI permission
  layer, which re-scopes every query to a single `user_id` and an explicit
  table/operation allow-list.
- A trigger auto-creates a `profiles` row when a new auth user signs up.

---

## 🤖 AI integration (AI-ready by design)

The AI endpoints let a future assistant read and update **selected** data
safely. All routes run on the Node runtime and are `force-dynamic`.

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/ai/summary/today` | read |
| GET | `/api/ai/habits` | read |
| PATCH | `/api/ai/habits/log` | write (upsert) |
| GET | `/api/ai/tasks` | read |
| POST | `/api/ai/tasks` | write |
| GET | `/api/ai/movies` | read |
| POST | `/api/ai/movies` | write |
| GET | `/api/ai/journal/recent` | read |
| POST | `/api/ai/journal` | write (upsert today) |
| GET | `/api/ai/analytics/last-30-days` | read |

### Authentication

The assistant authenticates with a shared secret:

```bash
curl https://your-app/api/ai/summary/today \
  -H "Authorization: Bearer $AI_API_KEY"
```

Example write:

```bash
curl -X PATCH https://your-app/api/ai/habits/log \
  -H "Authorization: Bearer $AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"habit_id":"<uuid>","completed":true}'
```

### Security model

- **No unrestricted DB access.** `src/lib/ai/permissions.ts` defines an
  allow-list (`AI_RESOURCE_POLICY`) of which tables the AI may read/write. Every
  request is scoped to `AI_USER_ID`.
- **Server-side permission layer.** `authorizeAiRequest()` validates the API key
  with a constant-time comparison and returns a scoped context;
  `assertPermission(resource, op)` gates each operation.
- **Audit logging.** Every write (and read, best-effort) is recorded in
  `ai_audit_logs` via `logAiAction()`.
- **No destructive deletes.** AI routes never delete data. Writes use inserts or
  non-destructive upserts. Any future delete endpoint must require **explicit
  confirmation** — marked with `TODO` comments in the code
  (`src/app/api/ai/tasks/route.ts`).
- **Secrets stay on the server.** The service role key and AI key are never sent
  to the browser; the Settings page intentionally shows a disabled key field.

---

## 🗺️ Roadmap

- Wire pages to Supabase (swap the local store for Supabase queries using the
  shared types).
- Supabase Auth (email magic link) + protected routes via middleware.
- Connect the AI assistant (function-calling over the `/api/ai/*` routes).
- Confirmation-gated destructive actions for the AI.
- PWA / mobile polish.

---

## 📄 License

Personal project — use freely.
