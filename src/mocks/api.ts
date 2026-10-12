import { http, HttpResponse, passthrough } from "msw";
import { ACCOUNTS, DEMO_PASSWORD, SCHOOLS, STUDENTS, TEACHERS } from "@/mocks/data";

const PAGE_SIZE = 8;

/**
 * A small stand-in for the backend so the UI can be built and demoed before
 * the API exists. These handlers are the shapes the real endpoints will have.
 */
export const handlers = [
  http.post("/api/auth/login", async ({ request }) => {
    const { email, password } = (await request.json()) as {
      email: string;
      password: string;
    };

    const account = ACCOUNTS[email];

    if (!account || password !== DEMO_PASSWORD) {
      return HttpResponse.json(
        { message: "Email or password is incorrect" },
        { status: 401 },
      );
    }

    return HttpResponse.json({
      token: "mock-token",
      user: account.user,
      schools: account.schools,
    });
  }),

  http.get("/api/platform/schools", () => HttpResponse.json(SCHOOLS)),

  http.post("/api/platform/schools", async ({ request }) => {
    const { name, slug } = (await request.json()) as { name: string; slug: string };

    if (SCHOOLS.some((school) => school.slug === slug)) {
      return HttpResponse.json(
        { message: "That URL is already taken", fields: { slug: "Already in use" } },
        { status: 409 },
      );
    }

    const school = {
      id: `sch_${slug}`,
      name,
      slug,
      status: "ACTIVE" as const,
      studentCount: 0,
      staffCount: 0,
    };
    SCHOOLS.push(school);

    return HttpResponse.json(school, { status: 201 });
  }),

  http.get("/api/t/:slug/students", ({ params, request }) => {
    const all = STUDENTS[params.slug as string] ?? [];
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const search = (url.searchParams.get("search") ?? "").toLowerCase();

    const matching = search
      ? all.filter((student) => `${student.name} ${student.className}`.toLowerCase().includes(search))
      : all;

    const start = (page - 1) * PAGE_SIZE;

    return HttpResponse.json({
      data: matching.slice(start, start + PAGE_SIZE),
      total: matching.length,
      page,
      pageSize: PAGE_SIZE,
    });
  }),

  http.get("/api/t/:slug/teachers", ({ params }) =>
    HttpResponse.json(TEACHERS[params.slug as string] ?? []),
  ),

  // Anything that is not /api/* is Next.js itself — let it through untouched.
  http.all("*", () => passthrough()),
];