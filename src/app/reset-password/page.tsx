import { Card, CardBody, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) {
  const token = searchParams.token ?? "";
  const email = searchParams.email ?? "";

  if (!token || !email) {
    return (
      <Card>
        <CardHeader title="Invalid reset link" />
        <CardBody>
          <p>This reset link is missing required information.</p>
          <Link href="/login" className="underline underline-offset-4">
            Go to sign in
          </Link>
        </CardBody>
      </Card>
    );
  }

  return <ResetPasswordForm token={token} email={email} />;
}
