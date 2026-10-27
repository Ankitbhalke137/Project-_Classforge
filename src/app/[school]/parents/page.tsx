"use client";

import { useState } from "react";
import ParentPortalPage from "@/app/[school]/parent/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table, TableSkeleton } from "@/components/ui/table";
import { schoolApi } from "@/lib/api";
import { useApi, useDebounced, useMembership, useRole } from "@/lib/hooks";
import type { Parent } from "@/types";

export default function ParentsPage() {
  const role = useRole();
  const membership = useMembership();
  const schoolSlug = membership?.schoolSlug ?? "";

  if (role === "PARENT") {
    return <ParentPortalPage />;
  }

  return <ParentsDirectory schoolSlug={schoolSlug} />;
}

function ParentsDirectory({ schoolSlug }: { schoolSlug: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const { data, loading, error } = useApi(
    () => schoolApi.listParents(schoolSlug, { page, search: query }),
    [schoolSlug, page, query],
  );

  const parents: Parent[] = data?.data ?? [];
  const total = data?.total ?? parents.length;
  const pageSize = data?.pageSize ?? 10;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parents &amp; Guardians"
        description="The parent directory for students enrolled in this school."
      />

      <Card>
        <div className="border-b border-line p-4">
          <div className="max-w-md">
            <Input
              label="Search"
              type="search"
              placeholder="Search by parent name, email or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : error ? (
          <p className="px-4 py-10 text-center text-sm text-body">
            Could not load parents directory.
          </p>
        ) : parents.length === 0 ? (
          <EmptyState
            title={query ? "No parents match this search" : "No parents yet"}
            description="Parents linked to enrolled students will appear here."
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Parent / Guardian</TH>
                  <TH>Contact</TH>
                  <TH>Occupation</TH>
                  <TH>Linked Students</TH>
                </TR>
              </THead>
              <TBody>
                {parents.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <span className="font-semibold text-primary">{p.name}</span>
                      <span className="block text-xs text-body">
                        {p.email || "No email on file"}
                      </span>
                    </TD>
                    <TD>{p.phone || "—"}</TD>
                    <TD>{p.occupation || "Guardian"}</TD>
                    <TD>
                      <Badge tone="brand">
                        {p.studentIds.length} {p.studentIds.length === 1 ? "student" : "students"}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <PaginationBar
              result={{
                data: parents,
                total,
                page,
                pageSize,
              }}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
