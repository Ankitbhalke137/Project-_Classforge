"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks";
import { schoolApi } from "@/lib/api";


function ClassesOverview({ schoolSlug }: { schoolSlug: string }) {
  const classes = useApi(() => schoolApi.listClasses(schoolSlug), [schoolSlug]);

  if (classes.loading) return <TableSkeleton rows={5} columns={6} />;
  const rows = classes.data ?? [];
  if (classes.error) return <div className="text-xs text-danger-600">Failed to load classes.</div>;

  return (
    <Card className="col-span-full">
      <CardHeader title="Classes & Sections" description="Existing classes and their sections." />
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState
            title="No classes found"
            description="Classes are created in the Classes & Sections screen."
            action={
              <Button variant="secondary">
                Manage Classes
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Class</TH>
                <TH>Grade</TH>
                <TH>Section</TH>
                <TH>Room</TH>
                <TH>Students</TH>
                <TH>Homeroom Teacher</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((cls) => (
                <TR key={cls.id}>
                  <TD>{cls.name}</TD>
                  <TD>{cls.grade}</TD>
                  <TD>{cls.section}</TD>
                  <TD>{cls.room}</TD>
                  <TD>{cls.studentCount}</TD>
                  <TD>
                    {cls.homeroomTeacherId ? (
                      <Badge tone="neutral" className="text-[11px]">
                        Assigned
                      </Badge>
                    ) : (
                      <Badge tone="neutral" className="text-[11px]">
                        Vacant
                      </Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

function SubjectsOverview({ schoolSlug }: { schoolSlug: string }) {
  const subjects = useApi(() => schoolApi.listSubjects(schoolSlug), [schoolSlug]);

  if (subjects.loading) return <TableSkeleton rows={5} columns={5} />;
  const rows = subjects.data ?? [];
  if (subjects.error) return <div className="text-xs text-danger-600">Failed to load subjects.</div>;

  return (
    <Card className="col-span-full">
      <CardHeader title="Subjects" description="Subjects offered across grades." />
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState
            title="No subjects found"
            description="Subjects are defined in the academic catalogue."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Subject</TH>
                <TH>Code</TH>
                <TH>Grades</TH>
                <TH>Max Marks</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((subject) => (
                <TR key={subject.id}>
                  <TD>{subject.name}</TD>
                  <TD>{subject.code}</TD>
                  <TD>{subject.grades.join(", ")}</TD>
                  <TD>{subject.maxMarks}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

export function AcademicSettingsSection() {
  const [activeView, setActiveView] = useState<"classes" | "subjects">("classes");
  const schoolSlug = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean)[0] : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-primary">Academic Year</h2>
              <p className="mt-0.5 text-[13px] text-body">
                Academic year management — start date, end date and the current year indicator —
                requires a backend endpoint that is not yet available.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-body">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-secondary-strong">
                ●
              </span>
              <span>No active academic year configured</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setActiveView("classes")}
            aria-pressed={activeView === "classes"}
            className={`w-full py-3 px-4 rounded-xl text-left font-medium transition-colors ${
              activeView === "classes"
                ? "bg-primary text-on-primary"
                : "bg-white text-body border border-line hover:bg-brand-50"
            }`}
          >
            <span className="flex items-center gap-2">
              Classes & Sections
            </span>
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setActiveView("subjects")}
            aria-pressed={activeView === "subjects"}
            className={`w-full py-3 px-4 rounded-xl text-left font-medium transition-colors ${
              activeView === "subjects"
                ? "bg-primary text-on-primary"
                : "bg-white text-body border border-line hover:bg-brand-50"
            }`}
          >
            <span className="flex items-center gap-2">
              Subjects
            </span>
          </button>
        </div>
      </div>

      {activeView === "classes" ? (
        <ClassesOverview schoolSlug={schoolSlug} />
      ) : (
        <SubjectsOverview schoolSlug={schoolSlug} />
      )}

      <Card>
        <CardBody className="px-5 py-4">
          <h3 className="text-sm font-semibold text-primary mb-3">Teacher Assignment Shortcuts</h3>
          <p className="text-[13px] text-body mb-4">
            Assign homeroom teachers and subject teachers through the Classes & Sections and
            Teachers screens.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm">
              Manage Classes
            </Button>
            <Button variant="secondary" size="sm">
              Manage Teachers
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
