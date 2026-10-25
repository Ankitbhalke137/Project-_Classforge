"use client";

import { useMemo, useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import { useApi, useDebounced, useIdentity, useMembership, useRole } from "@/lib/hooks";
import { formatNumber } from "@/lib/utils";
import type { SchoolClass, Subject, Teacher, TimetableSlot } from "@/types";
import { WEEKDAYS } from "@/types";

/** How many subject badges fit on a card before the overflow collapses to "+N". */
const VISIBLE_SUBJECTS = 4;

export default function ClassesPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [detailFor, setDetailFor] = useState<SchoolClass | null>(null);

  // Typed at once, requested once the typing stops.
  const debouncedSearch = useDebounced(search);

  const classes = useApi(
    () => schoolApi.listClasses(schoolSlug, { grade, search: debouncedSearch }),
    [schoolSlug, grade, debouncedSearch],
  );
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);
  const teachers = useApi(() => schoolApi.listTeachers(schoolSlug), [schoolSlug]);

  // Taken from the subjects rather than the class list, otherwise choosing a
  // grade would trim the dropdown down to just that grade.
  const grades = useMemo(
    () => [...new Set((subjects.data ?? []).flatMap((subject) => subject.grades))].sort(),
    [subjects.data],
  );

  const teacherList = useMemo(() => {
    const raw = teachers.data;
    if (Array.isArray(raw)) return raw;
    return (raw as unknown as { data: Teacher[] })?.data ?? [];
  }, [teachers.data]);

  const teacherName = useMemo(() => {
    const map = new Map(teacherList.map((teacher) => [teacher.id, teacher.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Unassigned") : "Unassigned");
  }, [teacherList]);

  const subjectById = useMemo(
    () => new Map((subjects.data ?? []).map((subject) => [subject.id, subject])),
    [subjects.data],
  );

  const rows = classes.data ?? [];
  const seated = rows.reduce((sum, item) => sum + item.studentCount, 0);
  const capacity = rows.reduce((sum, item) => sum + item.capacity, 0);
  const filtersActive = Boolean(grade || debouncedSearch);

  function clearFilters() {
    setSearch("");
    setGrade("");
  }

  return (
    <RequireArea area="classes">
      <div className="space-y-6">
        <PageHeader
          title="Classes"
          description="Every section in the school, who teaches it, and the weekly timetable."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Classes"
            value={classes.data ? formatNumber(classes.data.length) : "—"}
            hint="Sections on the roll"
          />
          <StatCard
            label="Students seated"
            value={classes.loading ? "—" : formatNumber(seated)}
            hint={`of ${formatNumber(capacity)} places`}
            tone={capacity > 0 && seated / capacity >= 0.9 ? "warning" : "default"}
          />
          <StatCard
            label="Subjects offered"
            value={subjects.data ? formatNumber(subjects.data.length) : "—"}
            hint="Across every grade"
            tone="positive"
          />
        </div>

        <Card>
          <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2">
            <Input
              label="Search"
              type="search"
              placeholder="Search by class or room"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              label="Grade"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              options={[
                { value: "", label: "All grades" },
                ...grades.map((value) => ({ value, label: value })),
              ]}
            />
          </div>

          {classes.loading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : classes.error ? (
            <ErrorState onRetry={classes.reload} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={filtersActive ? "No classes match" : "No classes yet"}
              description={
                filtersActive
                  ? "Try clearing the search or picking a different grade."
                  : "Once the academic year is set up, its sections appear here."
              }
              action={
                filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((schoolClass) => (
                <ClassCard
                  key={schoolClass.id}
                  schoolClass={schoolClass}
                  homeroom={teacherName(schoolClass.homeroomTeacherId)}
                  subjects={schoolClass.subjectIds
                    .map((id) => subjectById.get(id)?.name ?? id)
                    .sort()}
                  onOpen={() => setDetailFor(schoolClass)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {detailFor ? (
        <ClassDetailModal
          schoolSlug={schoolSlug}
          schoolClass={detailFor}
          subjects={subjects.data ?? []}
          teachers={teacherList}
          onClose={() => setDetailFor(null)}
        />
      ) : null}
    </RequireArea>
  );
}

function ClassCard({
  schoolClass,
  homeroom,
  subjects,
  onOpen,
}: {
  schoolClass: SchoolClass;
  homeroom: string;
  subjects: string[];
  onOpen: () => void;
}) {
  const full = schoolClass.studentCount >= schoolClass.capacity;
  const overflow = subjects.length - VISIBLE_SUBJECTS;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{schoolClass.name}</h3>
          <p className="text-xs text-body">Room {schoolClass.room}</p>
        </div>
        <Badge tone={full ? "amber" : "green"}>
          {schoolClass.studentCount}/{schoolClass.capacity}
        </Badge>
      </div>

      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-body">Form teacher</dt>
          <dd className="font-medium text-ink">{homeroom}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-body">Subjects</dt>
          <dd className="font-medium text-ink">{subjects.length}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1">
        {subjects.slice(0, VISIBLE_SUBJECTS).map((name) => (
          <Badge key={name} tone="brand">
            {name}
          </Badge>
        ))}
        {overflow > 0 ? <Badge tone="neutral">+{overflow}</Badge> : null}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-auto text-left text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        View class →
      </button>
    </Card>
  );
}

/**
 * One class, everything known about it: the subjects on the roll, who takes each
 * one, the students seated, and the week.
 *
 * The roster is only fetched for staff. A student or a parent is not on an
 * open-ended list of classmates, so they get a pointer to their own records
 * instead of an unrendered table.
 */
function ClassDetailModal({
  schoolSlug,
  schoolClass,
  subjects,
  teachers,
  onClose,
}: {
  schoolSlug: string;
  schoolClass: SchoolClass;
  subjects: Subject[];
  teachers: Teacher[];
  onClose: () => void;
}) {
  const role = useRole();
  const { identity } = useIdentity();
  const canSeeRoster = role === "SCHOOL_ADMIN" || role === "TEACHER";

  const timetable = useApi(
    () => schoolApi.getClassTimetable(schoolSlug, schoolClass.id),
    [schoolSlug, schoolClass.id],
  );

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  const slots = timetable.data ?? [];

  const onRoll = schoolClass.subjectIds
    .map((id) => subjectById.get(id))
    .filter((subject): subject is Subject => Boolean(subject))
    .sort((a, b) => a.name.localeCompare(b.name));

  // The timetable is the authoritative record of who takes what on this class,
  // so the subject list reads the teacher out of it rather than assuming.
  const teacherForSubject = (subjectId: string) => {
    const slot = slots.find((row) => row.subjectId === subjectId);
    return slot ? (teacherById.get(slot.teacherId) ?? "Unassigned") : "Not timetabled";
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={schoolClass.name}
      description={`${schoolClass.grade} · Room ${schoolClass.room} · ${schoolClass.studentCount} of ${schoolClass.capacity} places filled`}
      size="lg"
    >
      <div className="space-y-6">
        <section>
          <SectionHeading title="Subjects on the roll" count={onRoll.length} />
          {onRoll.length === 0 ? (
            <p className="py-6 text-center text-sm text-body">
              No subjects assigned to this class yet.
            </p>
          ) : (
            <ul className="grid gap-2 pt-3 sm:grid-cols-2">
              {onRoll.map((subject) => (
                <li
                  key={subject.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge tone="brand">{subject.code}</Badge>
                    <span className="truncate text-sm text-ink">{subject.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-body">
                    {teacherForSubject(subject.id)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading title="Students seated" count={schoolClass.studentCount} />
          {canSeeRoster ? (
            <Roster schoolSlug={schoolSlug} schoolClass={schoolClass} />
          ) : (
            <p className="pt-3 text-sm text-body">
              {identity?.student
                ? "This is your class. Your own attendance and results are on the Attendance tab."
                : "The class roster is visible to school staff."}
            </p>
          )}
        </section>

        <section>
          <SectionHeading title="Weekly timetable" count={slots.length} />
          <Timetable
            slots={slots}
            loading={timetable.loading}
            error={timetable.error}
            onRetry={timetable.reload}
            subjectById={subjectById}
            teacherById={teacherById}
          />
        </section>
      </div>
    </Modal>
  );
}

/** Only mounted for staff, so the request is unconditional here. */
function Roster({
  schoolSlug,
  schoolClass,
}: {
  schoolSlug: string;
  schoolClass: SchoolClass;
}) {
  const [page, setPage] = useState(1);

  const roster = useApi(
    () => schoolApi.listStudents(schoolSlug, { classId: schoolClass.id, page }),
    [schoolSlug, schoolClass.id, page],
  );

  if (roster.loading) return <TableSkeleton rows={4} columns={2} />;
  if (roster.error) return <ErrorState onRetry={roster.reload} />;

  const students = roster.data?.data ?? [];
  if (students.length === 0) {
    return (
      <p className="pt-3 text-sm text-body">Nobody is enrolled in this class yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-line pt-1">
      {students.map((student) => (
        <li key={student.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-sm text-ink">{student.name}</span>
            <span className="block truncate text-xs text-body">{student.admissionNo}</span>
          </span>
          <Badge tone={student.status === "ACTIVE" ? "green" : "neutral"}>
            {student.status === "ACTIVE" ? "Enrolled" : "Inactive"}
          </Badge>
        </li>
      ))}
      {roster.data && roster.data.total > roster.data.pageSize ? (
        <li className="flex items-center justify-between gap-3 pt-3">
          <span className="text-xs text-body">
            Showing {roster.data.data.length} of {roster.data.total}
          </span>
          <span className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= Math.ceil(roster.data!.total / roster.data!.pageSize)}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </span>
        </li>
      ) : null}
    </ul>
  );
}

function Timetable({
  slots,
  loading,
  error,
  onRetry,
  subjectById,
  teacherById,
}: {
  slots: TimetableSlot[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  subjectById: Map<string, Subject>;
  teacherById: Map<string, string>;
}) {
  const periods = useMemo(
    () => [...new Set(slots.map((slot) => slot.period))].sort((a, b) => a - b),
    [slots],
  );

  if (loading) return <TableSkeleton rows={6} columns={7} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (slots.length === 0) {
    return (
      <p className="pt-3 text-sm text-body">
        No timetable yet. Slots appear once the class is timetabled.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pt-3">
      <Table>
        <THead>
          <TR>
            <TH>Period</TH>
            {WEEKDAYS.map((day) => (
              <TH key={day}>{day.slice(0, 3)}</TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {periods.map((period) => (
            <TR key={period}>
              <TD className="font-medium text-ink">{period}</TD>
              {WEEKDAYS.map((day) => {
                const slot = slots.find((row) => row.day === day && row.period === period);

                return (
                  <TD key={day} className="min-w-28 align-top">
                    {slot ? (
                      <>
                        <span className="block font-medium text-ink">
                          {subjectById.get(slot.subjectId)?.code ?? slot.subjectId}
                        </span>
                        <span className="block text-xs text-body">
                          {teacherById.get(slot.teacherId) ?? "—"}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TD>
                );
              })}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <h3 className="flex items-center gap-2 pt-5 text-sm font-semibold text-ink">
      {title}
      <Badge tone="neutral">{count}</Badge>
    </h3>
  );
}