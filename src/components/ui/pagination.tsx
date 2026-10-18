import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import type { Paginated } from "@/types";

/** Previous / next controls driven by the server's page response. */
export function PaginationBar({
  result,
  onPageChange,
}: {
  result: Paginated<unknown>;
  onPageChange: (page: number) => void;
}) {
  const { page, pageSize, total } = result;
  if (total === 0) return null;

  const lastPage = Math.max(Math.ceil(total / pageSize), 1);
  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-sm text-body">
        Showing {formatNumber(firstRow)}–{formatNumber(lastRow)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="text-sm text-body">
          Page {page} of {lastPage}
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= lastPage}
        >
          Next
        </Button>
      </div>
    </div>
  );
}