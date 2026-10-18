import type { Paginated, School, Student, Teacher, User, Membership } from "@/types";

/* ------------------------------------------------------------------ *
 * Mock switch
 *
 * Mocks stand in for the backend until it is live. Requests then stay on
 * the current origin so the mock service worker can intercept them.
 * ------------------------------------------------------------------ */

export const MOCKS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MOCKS !== "false";

const BASE_URL = MOCKS_ENABLED ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "");

/* ------------------------------------------------------------------ *
 * The one fetch helper
 * ------------------------------------------------------------------ */

export class ApiError extends Error {
  status: number;
  /** Field-level messages, e.g. { email: "Email is already taken" }. */
  fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") clean[key] = String(value);
  }

  const search = new URLSearchParams(clean).toString();
  return search ? `${path}?${search}` : path;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.message ?? "Something went wrong",
      payload?.fields,
    );
  }

  return payload as T;
}

/* ------------------------------------------------------------------ *
 * Endpoints — these paths are the contract agreed with the backend.
 * ------------------------------------------------------------------ */

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: User; schools: Membership[] }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
};

/** Super Admin only. */
export const platformApi = {
  listSchools: () => api<School[]>("/api/platform/schools"),
  createSchool: (name: string, slug: string) =>
    api<School>("/api/platform/schools", { method: "POST", body: { name, slug } }),
};

/** Every school endpoint carries the school slug, so the backend knows whose data it is. */
export const schoolApi = {
  listStudents: (
    schoolSlug: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      classId?: string;
      sectionId?: string;
      status?: string;
      sort?: string;
    } = {},
  ) => api<Paginated<Student>>(withQuery(`/api/t/${schoolSlug}/students`, params)),
  getStudent: (schoolSlug: string, id: string) =>
    api<Student>(`/api/t/${schoolSlug}/students/${id}`),
  createStudent: (
    schoolSlug: string,
    body: {
      firstName: string;
      lastName: string;
      admissionNo: string;
      dateOfBirth?: string | null;
      email?: string | null;
      sectionId?: string | null;
      academicYearId?: string | null;
    },
  ) =>
    api<Student>(`/api/t/${schoolSlug}/students`, {
      method: "POST",
      body,
    }),
  updateStudent: (
    schoolSlug: string,
    id: string,
    body: {
      firstName?: string;
      lastName?: string;
      admissionNo?: string;
      dateOfBirth?: string | null;
      email?: string | null;
      sectionId?: string | null;
      academicYearId?: string | null;
      status?: "ACTIVE" | "INACTIVE" | "WITHDRAWN" | "COMPLETED" | "TRANSFERRED";
    },
  ) =>
    api<Student>(`/api/t/${schoolSlug}/students/${id}`, {
      method: "PATCH",
      body,
    }),
  deleteStudent: (schoolSlug: string, id: string, permanent?: boolean) =>
    api<{ message: string; deleted?: boolean; status?: string }>(
      withQuery(`/api/t/${schoolSlug}/students/${id}`, {
        permanent: permanent ? "true" : undefined,
      }),
      {
        method: "DELETE",
      },
    ),
  listClasses: (schoolSlug: string) =>
    api<{
      data: Array<{
        id: string;
        name: string;
        academicYear: { id: string; name: string; status: string };
        sections: Array<{ id: string; name: string }>;
      }>;
    }>(`/api/t/${schoolSlug}/classes`),
  listTeachers: (schoolSlug: string) =>
    api<Teacher[]>(`/api/t/${schoolSlug}/teachers`),
};