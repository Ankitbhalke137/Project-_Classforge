import { redirect } from "next/navigation";

/** `/greenwood` -> `/greenwood/dashboard` */
export default async function SchoolIndexPage({
  params,
}: {
  params: Promise<{ school: string }>;
}) {
  const { school } = await params;
  redirect(`/${school}/dashboard`);
}