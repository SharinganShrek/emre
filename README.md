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
    store.tsx              # HubProvider — local OR /api/hub sync
    local-data.ts          # localStorage helpers for local-only collections
    seed.ts                # mock dataset (local mode fallback)
    access.ts              # APP_PASSWORD unlock helpers
    selectors.ts           # derived data (streaks, completion, analytics)
    validation.ts          # zod schemas (forms + AI routes)
    supabase/              # hub-repository + admin (service role)
      config.ts            # public env check (no secrets)
      hub-repository.ts    # hub CRUD (used by /api/hub)
      admin.ts             # service role — hub API + AI (server-only)
    ai/                    # permission layer, audit logging, responses
supabase/
  mvp_schema.sql           # MVP tables (no auth.users FK)
  phase2_schema.sql        # practice_tests, research_*, milestones, counseling
  drop_auth_fks.sql        # patch if you already applied the old schema
  schema.sql               # fuller schema (legacy extras)
  seed.sql                 # optional sample SQL
```

### Access + data modes

1. **Password gate.** Set `APP_PASSWORD` in `.env.local`. The app redirects to
   `/unlock` until the correct password is entered (httpOnly cookie). Leave
   `APP_PASSWORD` empty to disable the gate in local/dev.

2. **Local mode.** If Supabase public env vars are missing, data lives in
   `localStorage` (`src/lib/seed.ts` sample).

3. **Supabase mode (hybrid).** When public Supabase env vars +
   `SUPABASE_SERVICE_ROLE_KEY` are set:
   - **Synced via `/api/hub`:** habits, habit_logs, tasks, journal_entries,
     movies, goals, milestones, study sessions, practice tests, research_*,
     books, notes, profiles.
   - **Still local-only:** gym sessions/exercises (fitness UI removed).
   - **College counseling:** separate document at `/api/college-counseling`
     (`college_counseling` table).
   - **No Supabase Auth** — the server stamps a built-in owner UUID on rows.

> The browser never receives the service role key. Hub sync goes through
> server routes that check the unlock cookie.

---

## 🚀 Getting started

### Prerequisites

- Node.js 18+ (tested on Node 22)
- npm
- [Supabase](https://supabase.com) project (optional — for cloud sync)

### Install & run (local mock mode)

```bash
npm install
cp .env.example .env.local
# Set APP_PASSWORD=your-secret (or leave empty to skip the unlock screen)
npm run dev
```

Open <http://localhost:3000>. Enter the password on `/unlock` if configured.

### Connect Supabase (optional)

**1. Create a Supabase project** at [supabase.com/dashboard](https://supabase.com/dashboard).

**2. Run the MVP schema** in **SQL Editor → New query**:

```
supabase/mvp_schema.sql
```

Then run Phase 2 (practice tests, research, milestones, college counseling):

```
supabase/phase2_schema.sql
```

If you already ran an older schema that referenced `auth.users`, also run:

```
supabase/drop_auth_fks.sql
```

**3. Copy keys** into `.env.local`:

```env
APP_PASSWORD=your-hub-password

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # NEVER expose to client
```

Restart `npm run dev`, unlock with `APP_PASSWORD`, then use the app —
synced tables go through `/api/hub`; college counseling through
`/api/college-counseling`.

**Optional (AI routes):**

```env
AI_API_KEY=generate-a-long-random-secret
```

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

Copy `.env.example` to `.env.local`:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `APP_PASSWORD` | **server only** | Fixed unlock password (empty = gate off) |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (RLS-locked; not used for hub writes) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Hub sync + AI (bypasses RLS) |
| `AI_API_KEY` | server only | Bearer token for `/api/ai/*` routes |

**Never expose `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD`, or `AI_API_KEY` to
the client.**

---

## 🗄️ Database schema (Supabase / Postgres)

Apply the schema in the Supabase SQL editor:

```
supabase/mvp_schema.sql      # base tables + RLS
supabase/phase2_schema.sql   # practice_tests, research_*, milestones, counseling
supabase/schema.sql          # legacy full schema (optional reference)
supabase/seed.sql            # optional SQL seed (replace user id first)
```

**Synced tables:** habits, habit_logs, tasks, goals, goal_milestones,
study_sessions, practice_tests, research_*, movies, books, journal_entries,
notes (+ profiles).

**Document store:** `college_counseling` (JSONB payload).

**Local-only:** gym sessions/exercises.

Every table has `id`, `created_at`, `updated_at` (auto-maintained by a trigger),
and a `user_id` UUID stamped by the server (built-in constant; no `auth.users` FK).

### Row Level Security assumptions

- **RLS is enabled on every MVP table** with `auth.uid() = user_id` policies.
  Without Supabase Auth, the anon key cannot read/write rows (good).
- The **service role** bypasses RLS and is used by `/api/hub` and AI routes.
  Both re-scope every query to the app's built-in owner UUID.
- Profile rows are created on first hub load (`ensureProfile`), not via Auth
  signup triggers.

---

## 🤖 AI integration (AI-ready by design)

The AI endpoints let a future assistant read and update **selected** data
safely. All routes run on the Node runtime and are `force-dynamic`.

OpenAPI schema (for Custom GPT Actions / tooling):

```
openapi/emre-hub-ai-actions.yaml
```

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/ai/summary/today` | read |
| GET | `/api/ai/habits` | read |
| PATCH | `/api/ai/habits/log` | write (upsert) |
| GET | `/api/ai/tasks` | read (`?status=` optional) |
| POST | `/api/ai/tasks` | write |
| GET | `/api/ai/movies` | read |
| POST | `/api/ai/movies` | write |
| GET | `/api/ai/journal/recent` | read (`?limit=` 1–30) |
| POST | `/api/ai/journal` | write (upsert by date) |
| GET | `/api/ai/analytics/last-30-days` | read |

### Response envelope

```json
{ "ok": true, "data": { } }
{ "ok": false, "error": "…", "details": null }
```

Validation failures return **422** with Zod `details`.

### Authentication

Set `AI_API_KEY` in `.env.local` (required for these routes). The assistant
sends the shared secret as a Bearer token:

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

Fallback header (same secret): `x-ai-api-key: $AI_API_KEY`.

### Security model

- **No unrestricted DB access.** `src/lib/ai/permissions.ts` defines an
  allow-list (`AI_RESOURCE_POLICY`) of which tables the AI may read/write. Every
  request is scoped to the built-in hub owner UUID (`getHubUserId()`).
- **Server-side permission layer.** `authorizeAiRequest()` validates the API key
  with a constant-time comparison; `assertPermission(resource, op)` gates each
  operation before any query.
- **Audit logging.** Every **write** is recorded in `ai_audit_logs` (request
  fails if the audit insert fails). Reads are logged best-effort.
- **No destructive deletes.** AI routes never delete data. Writes use inserts or
  non-destructive upserts only.
- **Validated bodies / query params.** Zod schemas in `src/lib/validation.ts`.
- **Secrets stay on the server.** `SUPABASE_SERVICE_ROLE_KEY` and `AI_API_KEY`
  are never sent to the browser (`import "server-only"` on admin + AI layers).

### Connecting a Custom GPT Action

Step-by-step checklist (env, deploy, import): see **`USER_ACTION_ITEMS.md`**.

1. Deploy Emre OS to a public HTTPS URL (Vercel, etc.).
2. In ChatGPT → **Create a GPT** → **Actions** → **Import from URL** or paste
   the contents of `openapi/emre-hub-ai-actions.yaml`.
3. Set the server URL to your deployment host (replace
   `https://YOUR_DEPLOYMENT_HOST` in the schema).
4. Under **Authentication**, choose **API Key** → Auth Type **Bearer**, and
   paste the same value as server `AI_API_KEY`.
5. Enable only the actions you want the GPT to call (prefer read routes first;
   add write routes when comfortable). Includes
   `getCollegeCounselingContextPack`.
6. Instruct the GPT in its system prompt to never invent destructive operations
   and to confirm before creating tasks/movies/journal entries.

### Connecting an internal assistant

- Point your agent’s HTTP / function-calling tools at the same OpenAPI file.
- Store `AI_API_KEY` only in the agent’s secret store (never in client code).
- Prefer calling `GET /api/ai/summary/today` as the default “context pack”, then
  narrower routes as needed.

---

## 🗺️ Roadmap

- Wire a Custom GPT / internal agent using `openapi/emre-hub-ai-actions.yaml`
  (see `USER_ACTION_ITEMS.md`).
- Confirmation-gated destructive actions for the AI (if ever needed).
- Richer offline caching / background sync for PWA.

---

## 📄 License

Personal project — use freely.
