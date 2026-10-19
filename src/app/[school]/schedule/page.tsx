import { ComingSoon } from "@/components/coming-soon";

/**
 * Placeholder until a timetable exists in the database.
 *
 * The schema has no timetable table and there is no endpoint that reads one, so
 * there is nothing this screen could show. It cannot be built without a
 * `TimetableSlot` model — the week grid depends on it.
 */
export default function SchedulePage() {
  return (
    <ComingSoon
      area="schedule"
      title="Schedule & timetable"
      description="The school week for each class, period by period."
      note="There is no timetable table in the database yet. This screen needs a TimetableSlot model — a section, a weekday, a period and a subject — before there is anything to read."
    />
  );
}