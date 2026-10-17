# ClassForge — Frontend

Multi-tenant school ERP. This repository is the frontend only; the backend is a
separate service, reached through `src/lib/api.ts`.

## Status

Frontend team scope: project setup, Tailwind, folder structure, the reusable
component library, routing, auth state, protected routes and role-based
navigation. Screens whose Figma design has not arrived are routed and guarded
but empty. Data runs against a mock API until the backend endpoints land — the
fixtures cover every module in the product, so a screen can be built against
realistic data before its design arrives.

## Running locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The mock API starts automatically and the sign-in
screen lists the demo accounts — password for all of them is `demo1234`.

| Account | What it shows |
| --- | --- |
| `admin@classforge.dev` | Super Admin — the `/platform` area |
| `principal@greenwood.edu` | School Admin, member of two schools, full sidebar |
| `teacher@greenwood.edu` | Teacher — no school switching |
| `student@greenwood.edu` | Student — read only, short sidebar |
| `parent@greenwood.edu` | Parent — two children, fees and report cards |
| `principal@northgate.edu` | School Admin of a suspended school — read-only |

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Environment

| Variable | Meaning |
| --- | --- |
| `NEXT_PUBLIC_ENABLE_MOCKS` | `true` (default) uses the mock API. Set `false` to talk to the real backend. |
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL. Unused while mocks are on. |

## Folder structure

```
src/
  app/                     routes (App Router — a folder is a URL)
    [school]/              dynamic segment: /greenwood, /riverside, ...
      dashboard/           a screen inside a school
      students/
    platform/              Super Admin area, kept outside every school route
    profile/  login/  no-access/
  components/
    ui/                    reusable: Button, Input, Card, Table, Modal,
                           Dropdown, Pagination, Badge, states, icons
    layout/                app shell, sidebar, navbar, platform shell
    auth/                  guards, sign-in form, session gate
  lib/
    api.ts                 the one fetch helper + endpoint definitions
    roles.ts               which roles may open which screen
    nav.ts                 sidebar items, href helpers, landing redirect
    hooks.ts               useSchoolSlug, useMembership, useRole, useCan, useApi
    utils.ts  slug.ts
  mocks/                   MSW handlers standing in for the backend
    fixtures/              the generated data, split by domain
  store/auth.ts            auth state (Zustand)
  types.ts                 every type in one file
  proxy.ts                 server-side redirect for signed-out users
```

## How the pieces fit

**Routing** is the folder structure. `/greenwood/students` comes from
`src/app/[school]/students/page.tsx` — `greenwood` arrives as `params.school`.

**Auth state** lives in `src/store/auth.ts`. `login` writes to it and to
sessionStorage, `logout` clears both, and `SessionGate` reads it back on start-up.

**Protected routes** are the three guards in `src/components/auth/guards.tsx`:
`RequireUser`, `RequireSuperAdmin` and `RequireSchoolMember`. Each school layout
composes the first and third, and `/platform` uses the second. `proxy.ts` does
the same redirect one step earlier, on the server, once the real backend sets its
cookie.

**Role-based navigation** comes from one table, `src/lib/roles.ts`. The sidebar
filters by it, and every screen is wrapped in `RequireArea` so a hidden screen is
also a blocked screen — typing the URL does not get you past it.

**Mock data** lives in `src/mocks/`. `api.ts` defines the endpoints and
`data.ts` the fixtures. The shapes here are the contract for the backend team;
swap them by setting `NEXT_PUBLIC_ENABLE_MOCKS=false`.

## Mock data

`src/mocks/data.ts` is one import path over `src/mocks/fixtures/`, which is split
by domain:

| File | Builds |
| --- | --- |
| `profile.ts` | the four demo tenants |
| `catalog.ts` | name pools, the subject catalogue, exam sessions, announcement copy |
| `random.ts` | seeded randomness and the school calendar |
| `academic.ts` | subjects, classes, timetable, exams, results |
| `people.ts` | teachers, students, parents |
| `operations.ts` | attendance, announcements, fees |
| `index.ts` | assembles the above per school and exposes the lookup maps |

Two things are deliberate. **Nothing calls `Math.random`** — every value comes
from a stream seeded by a string, so a reload shows the same school and
screenshots stay valid. **Dates are relative to today**, so the demo always shows
a term in progress and exams sitting on the horizon rather than last March.

### The four tenants

Each one exists to cover a state the UI has to handle.

| School | State | Data |
| --- | --- | --- |
| Greenwood High | active, large | 8 classes, 72 students, 14 teachers, 36 guardians |
| Riverside Academy | active, small | 2 classes, 18 students, 6 teachers |
| Northgate School | suspended | 1 class, 12 students — readable, not editable |
| Lakeside Prep | active, empty | staff and a class, nobody on the roll — the empty states |

### What each module generates

- **Attendance** — 30 school days per student, weighted by weekday, with
  `PRESENT / ABSENT / LATE / EXCUSED`. Inactive students are never marked, so
  daily totals are not exactly the class size.
- **Exams & grades** — 7 sessions across 3 terms per class per subject, each
  graded A+ to E. Results are correlated per student rather than random, so one
  report card reads plausibly. One session sits *today* and is only part-marked,
  which is the state the UI has to render for `marksObtained: null`.
- **Announcements** — 14 notices with real bodies, audiences, priorities, pinned
  flags, attachments and event dates.
- **Fees** — per student per term, across tuition, transport, examination and
  lab, in paid / partial / pending / overdue states.
- **People** — students carry class, gender, address, guardian and blood group;
  teachers carry employee number, subjects and the classes they teach. Guardians
  come in twos, so a parent can have two children in the school.

### Endpoints

All of these are in `src/lib/api.ts` and answered by `src/mocks/api.ts`:

```
POST   /api/auth/login
GET    /api/platform/schools            POST /api/platform/schools
PATCH  /api/platform/schools/:slug      GET  /api/platform/stats

GET    /api/t/:slug/students            ?page search classId status
GET    /api/t/:slug/students/:id
GET    /api/t/:slug/students/:id/attendance   ?days
GET    /api/t/:slug/students/:id/report-card  ?term
GET    /api/t/:slug/teachers            ?search
GET    /api/t/:slug/parents             ?page search
GET    /api/t/:slug/parents/:id/children
GET    /api/t/:slug/subjects
GET    /api/t/:slug/classes             ?grade search
GET    /api/t/:slug/classes/:id/timetable
GET    /api/t/:slug/attendance          ?date classId
GET    /api/t/:slug/attendance/register ?classId date
POST   /api/t/:slug/attendance
GET    /api/t/:slug/attendance/trend    ?days
GET    /api/t/:slug/exams               ?page search term status classId
GET    /api/t/:slug/exams/:id/results
POST   /api/t/:slug/exams/:id/publish
GET    /api/t/:slug/report-cards        ?classId term
GET    /api/t/:slug/announcements       ?page search priority audience
POST   /api/t/:slug/announcements
GET    /api/t/:slug/fees                ?page search status classId term
GET    /api/t/:slug/fees/summary
GET    /api/t/:slug/dashboard
```

List endpoints share one `pageOf` helper for pagination and one `matches` helper
for search, so each handler only holds what is specific to it.

## Known gaps

Module screens for classes, attendance, exams and announcements are placeholders
pending the Figma handover. The guards, permissions and routing for each are
already in place, and the fixtures and endpoints behind them are done — only the
UI is missing.

# Project-_Classforge
