import { ComingSoon } from "@/components/coming-soon";

/**
 * Placeholder until report cards can be read from the database.
 *
 * An earlier version of this screen rendered a fully built design with its own
 * hard-coded dataset — 42 sections, 28 submitted, scholars named std-1 — and made
 * no network calls at all. Every figure on it was invented, and the school it
 * described (42 sections) did not match the one in the database (20 sections,
 * no exams). It was removed rather than shown: an empty state is honest, a
 * confident-looking screen full of fiction is not.
 *
 * The `exams` and `marks` tables already exist, so this can be built properly
 * once there is a `report-cards` endpoint to read them through.
 */
export default function ReportsPage() {
  return (
    <ComingSoon
      area="report-cards"
      title="Reports & academic records"
      description="Whole-class report cards, published term results and the printable academic record."
      note="This screen had a finished design wired to hard-coded numbers that matched no real school. It has been removed rather than shown. The exams and marks tables exist, so a real version needs a report-cards endpoint reading them."
    />
  );
}