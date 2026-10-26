# ClassForge

Multi-tenant school ERP. One Next.js app serves both sides of the product:

- the **platform area** (`/platform`) where a Super Admin provisions schools and
  grants staff access, and
- the **school area** (`/<school-slug>/…`) where a school's own people work.

Data lives in PostgreSQL through Prisma. There is no mock API and no fixture
data — every row in the database belongs to a real person and a real school.

## Running locally

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run db:deploy              # apply migrations
npm run db:seed                # create the one Super Admin
npm run dev
```

Open http://localhost:3000 and sign in as the Super Admin.

### The Super Admin

The seed creates exactly one platform account, described entirely by
environment variables so no credential is written into this repository:

| Variable | Meaning |
| --- | --- |
| `SUPER_ADMIN_EMAIL` | the sign-in address |
| `SUPER_ADMIN_PASSWORD` | the initial password — change it after the first sign-in |
| `SUPER_ADMIN_NAME` | display name |

`npm run user:super-admin <email> [password] [name]` creates or re-promotes one
at any time, and `npm run user:clear-data` removes the demo rows so a fresh set
of real users can be set up through the console.

### Demo data

| Script | Purpose |
| --- | --- |
| `npm run db:seed-demo` | seed a school with demo students |
| `npm run db:assign-teachers` | attach those students to teachers |
| `npm run db:assign-noida` | assign the Noida school's teacher |

## Environment

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | signs the access token — at least 32 characters |
| `NEXT_PUBLIC_API_BASE_URL` | leave empty; the API routes live in this app |
| `NEXTAUTH_URL` | absolute base URL — used to build sign-in links in emails |
| `SMTP_HOST` `SMTP_PORT` | SMTP server, e.g. `smtp.gmail.com` and `587` |
| `SMTP_USER` `SMTP_PASS` | the sending account and its password |
| `SMTP_FROM` `SMTP_FROM_NAME` | the From line on outgoing mail |
| `PLATFORM_TENANT_LIMIT` | seats on the current plan, default 25 |
| `SUPER_ADMIN_EMAIL` | initial Super Admin login email for `npm run db:seed` |
| `SUPER_ADMIN_PASSWORD` | initial Super Admin password for `npm run db:seed` |
| `SUPER_ADMIN_NAME` | initial Super Admin display name for `npm run db:seed` |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm run start` | production build and serve |
| `npm run lint` | ESLint |
| `npm run db:deploy` | apply migrations |
| `npm run db:seed` | create the Super Admin from the environment |
| `npm run db:studio` | Prisma Studio |
| `npm run user:super-admin` | create or promote a Super Admin |
| `npm run user:clear-data` | wipe the demo rows (`--yes` to confirm) |
| `npm run smtp:test <email>` | check the SMTP connection and send a test email |
| `npm run test:platform` | end-to-end check of every Super Admin endpoint |
| `npm run test:p1` | end-to-end check of the P1 authorization and pagination rules |

## Emails

Invites are sent over SMTP. A Gmail account needs 2-Step Verification on and a
16-character App Password (Google Account → Security → App passwords) — the
normal account password is rejected by `smtp.gmail.com`.

`src/lib/email/` holds the transport, the `sendEmail()` wrapper and the
templates. `sendEmail()` never throws: a mail outage cannot fail a request that
already did its real work, and the caller is told whether the send happened.

## Folder structure

```
src/
  app/
    api/                     route handlers
      auth/                  sign-in
      platform/              Super Admin: schools, staff memberships, stats
      t/[tenantSlug]/        inside one school
    [school]/                dynamic segment: /greenwood, /riverside, ...
    platform/                Super Admin screens
  components/
    ui/                      Button, Input, Card, Table, Modal, Dropdown, ...
    layout/                  app shell, sidebar, platform shell
    auth/                    guards, sign-in form, session gate
    dashboard/               school and teacher overviews
    settings/                per-school settings
  lib/
    api.ts                   the one fetch helper + endpoint definitions
    auth.ts  auth-cookies.ts  refresh-tokens.ts
    platform-auth.ts         the Super Admin check
    tenant-context.ts        the school check, with row-level security
    email/                   transport, service, templates
    school-calendar.ts       academic years, terms and timetables
    schedule.ts              date helpers
    roles.ts  nav.ts  hooks.ts
  store/auth.ts              auth state (Zustand)
  types.ts                   every type in one file
  proxy.ts                   server-side redirect for signed-out users
prisma/
  schema.prisma              the data model
  seed.ts                    the Super Admin, and nothing else
```

## How the pieces fit

**Routing** is the folder structure. `/greenwood/students` comes from
`src/app/[school]/students/page.tsx` — `greenwood` arrives as `params.school`.

**Auth** is a signed httpOnly cookie. `POST /api/auth/login` verifies the
bcrypt hash, sets an access token (15 minutes) and a refresh token (7 days),
and the token is read back on every request. `jose` signs the access token;
`src/lib/auth.ts` is the only place that does.

**Two authorisation checks.** `requireSuperAdmin` (in `platform-auth.ts`) asks
whether the caller has the `SUPER_ADMIN` platform role. `resolveTenantContext`
(in `tenant-context.ts`) asks whether the caller has an active membership in
*this* school, and opens a transaction that sets `app.current_tenant_id` for
PostgreSQL row-level security. A Super Admin has no implicit access to a
school's student data — without a membership, they get 403 like anyone else.

**Role-based navigation** comes from one table, `src/lib/roles.ts`. The sidebar
filters by it, and every screen is wrapped in `RequireArea` so a hidden screen is
also a blocked screen — typing the URL does not get you past it.

**Per-school data.** A school's academic year, its terms and its bell times live
in the database, not in a constant, so no two schools are forced onto the same
calendar. A school gets sensible defaults when it is provisioned and can change
them afterwards. The breaks between periods are worked out from the times rather
than stored.

## Super Admin endpoints

```
POST   /api/auth/login
GET    /api/auth/me

GET    /api/platform/schools
POST   /api/platform/schools
PATCH  /api/platform/schools/:schoolId      name, slug, status
DELETE /api/platform/schools/:schoolId      suspended schools only; ?force=true

GET    /api/platform/admins
POST   /api/platform/admins                 creates the account, emails the password
PATCH  /api/platform/admins/:userId         role, status
DELETE /api/platform/admins/:userId?tenantId=…

GET    /api/platform/stats
```

Deleting a school is guarded twice: the school must already be suspended, and
one that still has people in it is refused unless `?force=true` is passed.

## School endpoints

```
POST   /api/t/:slug/invite              (Supports SCHOOL_ADMIN, TEACHER, and STUDENT roles)
GET    /api/t/:slug/students            ?page limit search classId sectionId status sort
GET    /api/t/:slug/students/:id
GET    /api/t/:slug/students/:id/attendance   ?days
GET    /api/t/:slug/students/:id/report-card  ?term
POST   /api/t/:slug/students/:id/resend-credentials
GET    /api/t/:slug/teachers            ?page limit search sort
GET    /api/t/:slug/parents             ?page search
GET    /api/t/:slug/parents/:id/children
GET    /api/t/:slug/subjects
GET    /api/t/:slug/classes             ?grade search
GET    /api/t/:slug/classes/:id/timetable
GET    /api/t/:slug/attendance          ?date classId
GET    /api/t/:slug/attendance/register ?classId date
POST   /api/t/:slug/attendance
GET    /api/t/:slug/attendance/trend    ?days
GET    /api/t/:slug/exams               ?page limit search term status classId
GET    /api/t/:slug/exams/:id/results
POST   /api/t/:slug/exams/:id/publish
GET    /api/t/:slug/report-cards        ?classId term
GET    /api/t/:slug/announcements       ?page limit search priority audience sectionId
POST   /api/t/:slug/announcements       (Section-scoped announcements with sectionId)
GET    /api/t/:slug/fees                ?page search status classId term
GET    /api/t/:slug/fees/summary
GET    /api/t/:slug/dashboard
GET    /api/t/:slug/calendar                the academic year, terms and timetable
GET    /api/t/:slug/notification-preferences
PUT    /api/t/:slug/notification-preferences
```

## Testing

`npm run test:platform` walks every Super Admin endpoint against a running dev
server: sign-in, the full CRUD on schools and on staff memberships, the
authorisation rules, and the cleanup. It creates what it needs and removes it
again, so the database is left as it was found.

## P1 frontend integration (draft)

The frontend P1 work sits in a **draft PR** and is **blocked on the backend P1
routes being merged into `develop`**. Against `develop` as it stands today the
following endpoints do not exist, so the screens below will 404 until the
backend P1 branch (`origin/backend`) is merged:

- `GET /api/auth/me` — current user profile + accessible schools (used by the
  auth/session restore flow in `src/store/auth.ts`)
- `GET /api/t/:slug/teachers?page&pageSize&search&sort&status` — paginated
  teachers roster (`src/app/[school]/teachers/page.tsx`)
- `GET /api/t/:slug/announcements?page&limit&search&priority&audience&sectionId`
  — paginated announcements; `POST` accepts optional `sectionId`; teachers are
  barred from school-wide notices (403)
  (`src/app/[school]/announcements/page.tsx`)
- `GET /api/t/:slug/exams?page&limit&search&status&classId&term` — paginated
  exams (`src/app/[school]/exams/page.tsx`)

Once those routes land on `develop`, the draft PR can be merged and the P1
frontend flows (auth/school selection, paginated Teachers & Exams, section-scoped
Announcements) will resolve end-to-end. A Student Invitation UI page does not
exist yet in the frontend; the backend `/invite` route handles student creation
with generated admission numbers and optional section assignment.

