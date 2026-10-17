import { RequireArea } from "@/components/auth/guards";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/states";
import type { SchoolArea } from "@/lib/roles";

/**
 * A screen whose design has not landed yet.
 *
 * The route, the guard and the role check are already in place, so the finished
 * screen only has to be dropped into `children` — nothing else needs to move.
 */
export function ComingSoon({
  area,
  title,
  description,
  note,
}: {
  area: SchoolArea;
  title: string;
  description: string;
  /** Why this screen is still a placeholder, stated for the reader. */
  note?: string;
}) {
  return (
    <RequireArea area={area}>
      <div className="space-y-6">
        <PageHeader title={title} description={description} />
        <Card>
          <EmptyState
            title="This screen is on its way"
            description={note ?? "The route, the guard and the role check are in place."}
          />
        </Card>
      </div>
    </RequireArea>
  );
}