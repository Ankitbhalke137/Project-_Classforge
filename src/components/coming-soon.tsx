import { RequireArea } from "@/components/auth/guards";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/states";
import type { SchoolArea } from "@/lib/roles";

/**
 * A screen whose design has not arrived from the UI team yet. The route, the
 * guard and the role check are already in place, so the Figma screen only has
 * to be dropped in here.
 */
export function ComingSoon({
  area,
  title,
  description,
}: {
  area: SchoolArea;
  title: string;
  description: string;
}) {
  return (
    <RequireArea area={area}>
      <div className="space-y-6">
        <PageHeader title={title} description={description} />
        <Card>
          <EmptyState
            title="Screen awaiting the UI team's design"
            description="The route, the guard and the role check are in place. The Figma screen drops in here."
          />
        </Card>
      </div>
    </RequireArea>
  );
}