# ClassForge — Frontend

Multi-tenant school ERP. This repository is the frontend only; the backend is a
separate service, reached through `src/lib/api.ts`.

## Status

Frontend team scope: project setup, Tailwind, folder structure, the reusable
component library, routing, auth state, protected routes and role-based
navigation. Screens whose Figma design has not arrived are routed and guarded
but empty. Data runs against a mock API until the backend endpoints land.

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
| `student@greenwood.edu` | Student — short, read-only sidebar |

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

**Mock data** lives in `src/mocks/`. `api.ts` defines the endpoints and `data.ts`
the fixtures. The shapes here are the contract for the backend team; swap them by
setting `NEXT_PUBLIC_ENABLE_MOCKS=false`.

## Known gaps

Module screens for classes, attendance, exams and announcements are placeholders
pending the Figma handover. The guards, permissions and routing for each are
already in place — only the UI is missing.# Project-_Classforge
