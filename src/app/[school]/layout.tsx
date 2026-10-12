import { RequireSchoolMember, RequireUser } from "@/components/auth/guards";
import { SchoolShell } from "@/components/layout/school-shell";

/**
 * Every screen inside a school. The `[school]` folder name is the dynamic
 * segment, so `/greenwood/dashboard` passes "greenwood" in as `params.school`
 * and the guards below check that this account belongs to it.
 */
export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;

  return (
    <RequireUser>
      <RequireSchoolMember>
        <SchoolShell schoolSlug={school}>{children}</SchoolShell>
      </RequireSchoolMember>
    </RequireUser>
  );
}