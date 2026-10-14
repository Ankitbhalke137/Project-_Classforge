"use client";

import { useMemo, useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Card, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import { useApi, useMembership } from "@/lib/hooks";
import { formatNumber } from "@/lib/utils";
import type { SchoolClass, Subject, Teacher } from "@/types";
import { WEEKDAYS } from "@/types";

export default function ClassesPage() {
  const schoolSlug = useMembership()?.schoolSlug ?? "";
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [timetableFor, setTimetableFor] = useState<SchoolClass | null>(null);

  const classes = useApi(
    () => schoolApi.listClasses(schoolSlug, { grade, search }),
    [schoolSlug, grade, search],
  );
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);
  const teachers = useApi(() => schoolApi.listTeachers(schoolSlug), [schoolSlug]);

  // Taken from the subjects rather than the class list, otherwise choosing a
  // grade would trim the dropdown down to just that grade.
  const grades = useMemo(
    () => [...new Set((subjects.data ?? []).flatMap((subject) => subject.grades))].sort(),
    [subjects.data],
  );

  const teacherName = useMemo(() => {
    const map = new Map((teachers.data ?? []).map((teacher) => [teacher.id, teacher.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Unassigned") : "Unassigned");
  }, [teachers.data]);

  const subjectName = useMemo(() => {
    const map = new Map((subjects.data ?? []).map((subject) => [subject.id, subject.name]));
    return (id: string) => map.get(id) ?? id;
  }, [subjects.data]);

  const seated = (classes.data ?? []).reduce((sum, item) => sum + item.studentCount, 0);
  const capacity = (classes.data ?? []).reduce((sum, item) => sum + item.capacity, 0);
  const rows = classes.data ?? [];

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
            value={formatNumber(seated)}
            hint={`of ${formatNumber(capacity)} places`}
          />
          <StatCard
            label="Subjects offered"
            value={subjects.data ? formatNumber(subjects.data.length) : "—"}
            tone="positive"
          />
        </div>

        <Card>
          <div className="grid gap-4 border-b border-slate-200 p-4 sm:grid-cols-2">
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
          ) : rows.length === 0 ? (
            <EmptyState
              title="No classes match"
              description="Try clearing the search or picking a different grade."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setGrade("");
                  }}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((schoolClass) => (
                <ClassCard
                  key={schoolClass.id}
                  schoolClass={schoolClass}
                  homeroom={teacherName(schoolClass.homeroomTeacherId)}
                  subjectNames={schoolClass.subjectIds.map(subjectName)}
                  onViewTimetable={() => setTimetableFor(schoolClass)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {timetableFor ? (
        <TimetableModal
          schoolSlug={schoolSlug}
          schoolClass={timetableFor}
          subjects={subjects.data ?? []}
          teachers={teachers.data ?? []}
          onClose={() => setTimetableFor(null)}
        />
      ) : null}
    </RequireArea>
  );
}

function ClassCard({
  schoolClass,
  homeroom,
  subjectNames,
  onViewTimetable,
}: {
  schoolClass: SchoolClass;
  homeroom: string;
  subjectNames: string[];
  onViewTimetable: () => void;
}) {
  const full = schoolClass.studentCount >= schoolClass.capacity;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{schoolClass.name}</h3>
          <p className="text-xs text-slate-500">Room {schoolClass.room}</p>
        </div>
        <Badge tone={full ? "amber" : "green"}>
          {schoolClass.studentCount}/{schoolClass.capacity}
        </Badge>
      </div>

      <dl className="space-y-1 text-xs text-slate-600">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Form teacher</dt>
          <dd className="font-medium text-slate-900">{homeroom}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Subjects</dt>
          <dd>{subjectNames.length}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1">
        {subjectNames.slice(0, 4).map((name) => (
          <Badge key={name} tone="brand">
            {name}
          </Badge>
        ))}
        {subjectNames.length > 4 ? (
          <Badge tone="neutral">+{subjectNames.length - 4}</Badge>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onViewTimetable}
        className="mt-auto text-left text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        View timetable →
      </button>
    </div>
  );
}

/** Own component so the timetable fetch is unconditional while it is open. */
function TimetableModal({
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
  const timetable = useApi(
    () => schoolApi.getClassTimetable(schoolSlug, schoolClass.id),
    [schoolSlug, schoolClass.id],
  );

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  const slots = timetable.data ?? [];
  const periods = [...new Set(slots.map((slot) => slot.period))].sort((a, b) => a - b);

  return (
    <Modal
      open
      onClose={onClose}
      title={`${schoolClass.name} timetable`}
      description={`Room ${schoolClass.room}`}
      size="lg"
    >
      {timetable.loading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : slots.length === 0 ? (
        <EmptyState
          title="No timetable yet"
          description="Slots appear once the class is timetabled."
        />
      ) : (
        <div className="overflow-x-auto">
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
                  <TD className="font-medium text-slate-900">{period}</TD>
                  {WEEKDAYS.map((day) => {
                    const slot = slots.find((row) => row.day === day && row.period === period);

                    return (
                      <TD key={day} className="min-w-28 align-top">
                        {slot ? (
                          <>
                            <span className="block font-medium text-slate-900">
                              {subjectById.get(slot.subjectId)?.code ?? slot.subjectId}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {teacherById.get(slot.teacherId) ?? "—"}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TD>
                    );
                  })}
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Modal>
  );
}