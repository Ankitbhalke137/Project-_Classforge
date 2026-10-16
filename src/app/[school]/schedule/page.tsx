import { ComingSoon } from "@/components/coming-soon";

export default function SchedulePage() {
  return (
    <ComingSoon
      area="schedule"
      title="Schedule & timetable"
      description="The school week, period times and each class's timetable."
      note="Timetable slots already exist in the model and the API serves one class at a time. This screen needs a school-wide read before it can show a full week."
    />
  );
}