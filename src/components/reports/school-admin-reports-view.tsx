"use client";

import { useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  DownloadIcon,
  FilterIcon,
  PlusIcon,
  PrinterIcon,
  SendIcon,
  SlidersIcon,
  SparklesIcon,
  TrophyIcon,
  PresentationChartIcon,
  ClipboardIcon,
  CalendarIcon,
  DocumentReportIcon,
  CloseIcon,
  SearchIcon,
  VerifiedIcon,
} from "@/components/ui/icons";
import {
  INITIAL_SUMMARY_METRICS,
  INITIAL_EXAM_SCHEDULE,
  INITIAL_GRADE_DISTRIBUTION,
  INITIAL_DEANS_DIGEST,
  INITIAL_STUDENTS_LEDGER,
  GRADE_FILTER_OPTIONS,
  SECTION_FILTER_OPTIONS,
  SUBJECT_FILTER_OPTIONS,
} from "./reports-data";

export function SchoolAdminReportsView() {
  /* Tabs */
  const [activeTab, setActiveTab] = useState<
    "ledger" | "issuance" | "thresholds"
  >("ledger");

  /* Filter states */
  const [selectedGrade, setSelectedGrade] = useState("Grade 6");
  const [selectedSection, setSelectedSection] = useState("Section A (Emerald)");
  const [selectedSubject, setSelectedSubject] = useState(
    "All Subjects (Composite Ledger)"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [attendanceMin, setAttendanceMin] = useState<number>(0);
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");

  /* Selection state - default to first 3 scholars selected as in screenshot */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(["std-1", "std-2", "std-4"])
  );

  /* Modal & Dialog States */
  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false);
  const [showGradingCriteriaModal, setShowGradingCriteriaModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /* Filtered records */
  const filteredStudents = useMemo(() => {
    return INITIAL_STUDENTS_LEDGER.filter((student) => {
      // Search by name, rollNo, or studentId
      const matchesSearch =
        searchQuery.trim() === "" ||
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchQuery.toLowerCase());

      // Grade letter filter
      const matchesGrade =
        gradeFilter === "ALL" || student.letterGrade === gradeFilter;

      // Attendance filter
      const matchesAttendance = student.attendance >= attendanceMin;

      return matchesSearch && matchesGrade && matchesAttendance;
    });
  }, [searchQuery, gradeFilter, attendanceMin]);

  /* Selection helpers */
  const allSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((student) => selectedIds.has(student.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
    }
  }

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function triggerToast(message: string) {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <VerifiedIcon width={18} height={18} className="text-emerald-400" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>
      )}

      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {/* Tag / Context */}
          <div className="flex items-center gap-2">
            <span className="h-3 w-1 rounded-full bg-emerald-600" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              ACADEMIC YEAR 2024–25 • TERM EVALUATION CONTROL
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Examinations &amp; Academic Reports
          </h1>

          <p className="mt-1 max-w-2xl text-xs text-body sm:text-sm">
            Manage assessment schedules, grade entry, report cards, and performance
            analytics across all school divisions.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowGradingCriteriaModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-slate-50"
          >
            <SlidersIcon width={16} height={16} className="text-slate-600" />
            <span>Grading Criteria</span>
          </button>

          <button
            type="button"
            onClick={() => triggerToast("Board Ledger exported as CSV (840 records).")}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-slate-50"
          >
            <DownloadIcon width={16} height={16} className="text-slate-600" />
            <span>Export Board Ledger</span>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerToast("Generating report cards for Grade 6 Section A...")
            }
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
          >
            <DocumentReportIcon width={16} height={16} className="text-emerald-700" />
            <span>Generate Report Cards</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewAssessmentModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f382c] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#064e3b]"
          >
            <PlusIcon width={16} height={16} />
            <span>New Assessment</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: ACTIVE CYCLE */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                ACTIVE CYCLE
              </span>
              <CalendarIcon width={18} height={18} className="text-emerald-700" />
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">
              {INITIAL_SUMMARY_METRICS.activeCycle.term}
            </p>
            <p className="mt-1 text-xs text-muted">
              {INITIAL_SUMMARY_METRICS.activeCycle.kickoffText}
            </p>
          </div>
          <div className="mt-4">
            <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Scheduled: {INITIAL_SUMMARY_METRICS.activeCycle.scheduledDays} Days
            </span>
          </div>
        </div>

        {/* Card 2: LEDGER SUBMISSION */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                LEDGER SUBMISSION
              </span>
              <ClipboardIcon width={18} height={18} className="text-emerald-700" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-ink">
                {INITIAL_SUMMARY_METRICS.ledgerSubmission.completedSections}
              </span>
              <span className="text-lg font-medium text-slate-400">
                / {INITIAL_SUMMARY_METRICS.ledgerSubmission.totalSections}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Sections submitted certified marks
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            {/* Split Progress Bar */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="bg-[#0f382c]"
                style={{
                  width: `${INITIAL_SUMMARY_METRICS.ledgerSubmission.percentComplete}%`,
                }}
              />
              <div
                className="bg-amber-400"
                style={{
                  width: `${
                    100 - INITIAL_SUMMARY_METRICS.ledgerSubmission.percentComplete
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted">
                {INITIAL_SUMMARY_METRICS.ledgerSubmission.percentComplete}% completed
              </span>
              <span className="font-medium text-amber-600">
                {INITIAL_SUMMARY_METRICS.ledgerSubmission.pendingCount} pending
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: SCHOOL AVERAGE */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                SCHOOL AVERAGE
              </span>
              <PresentationChartIcon width={18} height={18} className="text-emerald-700" />
            </div>
            <p className="mt-2 text-2xl font-bold text-ink">
              {INITIAL_SUMMARY_METRICS.schoolAverage.cumulativeScore}%
            </p>
            <p className="mt-1 text-xs text-muted">
              Cross-curriculum cumulative score
            </p>
          </div>
          <div className="mt-4">
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <span className="text-sm font-bold">↗</span>
              {INITIAL_SUMMARY_METRICS.schoolAverage.trendLabel}
            </span>
          </div>
        </div>

        {/* Card 4: HONOR COHORT */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                HONOR COHORT
              </span>
              <TrophyIcon width={18} height={18} className="text-amber-500" />
            </div>
            <p className="mt-2 text-lg font-bold text-ink">
              {INITIAL_SUMMARY_METRICS.honorCohort.title}
            </p>
            <p className="mt-1 text-xs text-muted">
              {INITIAL_SUMMARY_METRICS.honorCohort.subtitle}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-lg font-bold text-emerald-700">
              {INITIAL_SUMMARY_METRICS.honorCohort.score}%
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              {INITIAL_SUMMARY_METRICS.honorCohort.scholarsCount} Scholars
            </span>
          </div>
        </div>
      </div>

      {/* 3. Upcoming Exam Hall Schedule */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon width={20} height={20} className="text-emerald-700" />
            <h2 className="text-sm font-bold text-ink sm:text-base">
              Upcoming Exam Hall Schedule
            </h2>
          </div>
          <p className="text-xs text-muted">
            Central Examination Cell • Auditorium &amp; Blocks A–D
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {INITIAL_EXAM_SCHEDULE.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-line bg-slate-50/40 p-4 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
            >
              <div>
                {/* Date & Status Pills */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold tracking-tight ${
                      item.datePillColor ?? "bg-slate-900 text-white"
                    }`}
                  >
                    {item.dateBadge}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      item.statusTone === "green"
                        ? "bg-emerald-100 text-emerald-800"
                        : item.statusTone === "blue"
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {item.statusBadge}
                  </span>
                </div>

                {/* Exam Title & Subject */}
                <h3 className="mt-3 text-sm font-bold text-ink">{item.title}</h3>
                <p className="mt-1 text-xs text-muted">{item.subtitle}</p>
              </div>

              {/* Time & Enrolled Row */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <ClockIcon width={14} height={14} className="text-slate-400" />
                  <span>{item.timeRange}</span>
                </div>
                <div>
                  <span className="font-bold text-emerald-700">
                    {item.enrolledCount}
                  </span>{" "}
                  <span className="text-[11px] text-muted">Enrolled</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Cohort Grade Distribution & Dean's Academic Digest */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left (2 Cols): Cohort Grade Distribution */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-sm lg:col-span-2">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-ink sm:text-base">
                  Cohort Grade Distribution
                </h2>
                <p className="text-xs text-muted">
                  Class 6–10 Mid-Term Marks Dispersion Analysis
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                N = 840 Verified Scores
              </span>
            </div>

            {/* Distribution Rows */}
            <div className="mt-5 space-y-3.5">
              {INITIAL_GRADE_DISTRIBUTION.map((item) => (
                <div key={item.grade} className="flex items-center gap-3">
                  {/* Grade label */}
                  <span className="w-7 text-xs font-bold text-ink">
                    {item.grade}
                  </span>

                  {/* Horizontal Bar */}
                  <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${item.barColor}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>

                  {/* Percentage & Count */}
                  <div className="flex w-28 items-baseline justify-end gap-1.5 text-right">
                    <span className="text-xs font-bold text-ink">
                      {item.percentage}%
                    </span>
                    <span className="text-[11px] text-muted">
                      {item.studentCount} students
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 text-muted">
              <span className="size-2 rounded-full bg-emerald-600" />
              <span>Dean&apos;s Honor Band: 62% in Tier 1 (A/A+)</span>
            </div>
            <span className="font-semibold text-emerald-700">
              Standard Deviation: σ 4.2
            </span>
          </div>
        </div>

        {/* Right (1 Col): Dean's Academic Digest */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <SparklesIcon width={16} height={16} className="text-emerald-700" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                {INITIAL_DEANS_DIGEST.title}
              </h2>
            </div>

            <h3 className="mt-2.5 text-sm font-bold text-ink">
              {INITIAL_DEANS_DIGEST.subtitle}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-body">
              {INITIAL_DEANS_DIGEST.content}
            </p>
          </div>

          {/* Metrics Box */}
          <div className="mt-6 rounded-xl border border-indigo-100 bg-[#f1f4ff]/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Board Pass Forecast</span>
              <span className="font-bold text-emerald-700">
                {INITIAL_DEANS_DIGEST.boardPassForecast}% Estimated
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-indigo-100/80 pt-2">
              <span className="text-slate-600">Intervention Caseload</span>
              <span className="font-bold text-amber-600">
                {INITIAL_DEANS_DIGEST.interventionCaseload} Students Flagged
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Class Performance Ledger & Tabbed Table */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "ledger"
                ? "bg-white text-ink shadow-sm ring-1 ring-slate-200"
                : "text-muted hover:text-ink"
            }`}
          >
            Class Performance Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("issuance")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "issuance"
                ? "bg-white text-ink shadow-sm ring-1 ring-slate-200"
                : "text-muted hover:text-ink"
            }`}
          >
            Report Card Issuance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("thresholds")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "thresholds"
                ? "bg-white text-ink shadow-sm ring-1 ring-slate-200"
                : "text-muted hover:text-ink"
            }`}
          >
            Grade Thresholds &amp; Rubrics
          </button>
        </div>

        {/* Tab 1: Class Performance Ledger View */}
        {activeTab === "ledger" && (
          <div className="mt-4 space-y-4">
            {/* Active View Label */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-muted">Active View:</span>
              <span className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                {selectedGrade} • {selectedSection.split(" ")[0]} {selectedSection.split(" ")[1]}
              </span>
            </div>

            {/* Filter Dropdowns Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Grade Selector */}
              <div className="relative">
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="appearance-none rounded-xl border border-line bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-ink shadow-sm focus:border-emerald-600 focus:outline-none"
                >
                  {GRADE_FILTER_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      Grade: {g}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  width={14}
                  height={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>

              {/* Section Selector */}
              <div className="relative">
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="appearance-none rounded-xl border border-line bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-ink shadow-sm focus:border-emerald-600 focus:outline-none"
                >
                  {SECTION_FILTER_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      Section: {s}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  width={14}
                  height={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>

              {/* Subject Selector */}
              <div className="relative">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="appearance-none rounded-xl border border-line bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-ink shadow-sm focus:border-emerald-600 focus:outline-none"
                >
                  {SUBJECT_FILTER_OPTIONS.map((subj) => (
                    <option key={subj} value={subj}>
                      Subject: {subj}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  width={14}
                  height={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>

              {/* Student / Roll Filter Input */}
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <SearchIcon
                  width={14}
                  height={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  placeholder="Filter student or roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-muted shadow-sm focus:border-emerald-600 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    <CloseIcon width={12} height={12} />
                  </button>
                )}
              </div>

              {/* More Filters Toggle */}
              <button
                type="button"
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition ${
                  showMoreFilters
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-line bg-white text-ink hover:bg-slate-50"
                }`}
              >
                <FilterIcon width={14} height={14} />
                <span>More Filters</span>
                <ChevronDownIcon
                  width={12}
                  height={12}
                  className={showMoreFilters ? "rotate-180 transition" : "transition"}
                />
              </button>
            </div>

            {/* Extended Filters Drawer */}
            {showMoreFilters && (
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-slate-50/70 p-3 text-xs text-body animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">Filter Grade Band:</span>
                  <select
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs"
                  >
                    <option value="ALL">All Grades</option>
                    <option value="A+">A+ only</option>
                    <option value="A">A only</option>
                    <option value="B+">B+ only</option>
                    <option value="B">B only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">
                    Min Attendance: {attendanceMin}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={95}
                    step={5}
                    value={attendanceMin}
                    onChange={(e) => setAttendanceMin(Number(e.target.value))}
                    className="accent-emerald-600"
                  />
                </div>

                {(gradeFilter !== "ALL" || attendanceMin > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setGradeFilter("ALL");
                      setAttendanceMin(0);
                    }}
                    className="ml-auto text-xs font-medium text-emerald-700 hover:underline"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            )}

            {/* Data Table */}
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                {/* Table Header */}
                <thead className="border-b border-line bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="size-4 rounded border-slate-300 text-emerald-700 accent-emerald-700"
                      />
                    </th>
                    <th className="px-4 py-3">STUDENT &amp; ROLL</th>
                    <th className="px-4 py-3">CLASS</th>
                    <th className="px-4 py-3">TERM 1 FINAL</th>
                    <th className="px-4 py-3">T2 MID-TERM</th>
                    <th className="px-4 py-3">LAB / PROJECT</th>
                    <th className="px-4 py-3">TOTAL SCORE</th>
                    <th className="px-4 py-3">GRADE</th>
                    <th className="px-4 py-3">ATTENDANCE</th>
                    <th className="px-4 py-3">REPORT CARD</th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-line bg-white">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-sm text-muted">
                        No student records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((row) => {
                      const isSelected = selectedIds.has(row.id);
                      return (
                        <tr
                          key={row.id}
                          className={`transition hover:bg-slate-50/60 ${
                            isSelected ? "bg-emerald-50/20" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(row.id)}
                              className="size-4 rounded border-slate-300 text-emerald-700 accent-emerald-700"
                            />
                          </td>

                          {/* Student & Roll */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${row.avatarBgColor}`}
                              >
                                {row.avatarInitials}
                              </span>
                              <div>
                                <span className="block font-bold text-ink">
                                  {row.name}
                                </span>
                                <span className="block text-[11px] text-muted">
                                  Roll: {row.rollNo} • ID: {row.studentId}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Class */}
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {row.className}
                          </td>

                          {/* Term 1 Final */}
                          <td className="px-4 py-3 text-slate-700">
                            {row.term1Final.toFixed(1)}%
                          </td>

                          {/* T2 Mid-Term */}
                          <td className="px-4 py-3 font-semibold text-emerald-700">
                            {row.t2MidTerm.toFixed(1)}%
                          </td>

                          {/* Lab / Project */}
                          <td className="px-4 py-3 text-slate-700">
                            {row.labProject}
                          </td>

                          {/* Total Score */}
                          <td className="px-4 py-3 font-bold text-ink">
                            {row.totalScore.toFixed(1)}%
                          </td>

                          {/* Grade Badge */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                                row.letterGrade === "A+"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : row.letterGrade === "A"
                                  ? "bg-teal-100 text-teal-800"
                                  : row.letterGrade === "B+"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {row.letterGrade}
                            </span>
                          </td>

                          {/* Attendance */}
                          <td className="px-4 py-3 text-slate-700">
                            {row.attendance.toFixed(1)}%
                          </td>

                          {/* Report Card Action / Status */}
                          <td className="px-4 py-3">
                            {row.reportCardStatus === "GENERATED" ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckIcon width={14} height={14} />
                                <span>Generated</span>
                              </span>
                            ) : row.reportCardStatus === "PENDING_REVIEW" ? (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                                <ClockIcon width={14} height={14} />
                                <span>Pending Review</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                                <SlidersIcon width={14} height={14} />
                                <span>Needs Sign-off</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Report Card Issuance View */}
        {activeTab === "issuance" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-line bg-slate-50/50 p-6 text-center">
              <DocumentReportIcon
                width={36}
                height={36}
                className="mx-auto text-emerald-700"
              />
              <h3 className="mt-3 text-sm font-bold text-ink">
                Batch Report Card Publishing Queue
              </h3>
              <p className="mt-1 text-xs text-muted">
                32 of 34 report cards for Grade 6 Section A are certified and ready for
                parent release.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => triggerToast("Dispatching notifications to parents...")}
                  className="rounded-xl bg-[#0f382c] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#064e3b]"
                >
                  Publish Certified Cards
                </button>
                <button
                  type="button"
                  onClick={() => triggerToast("Generating batch PDF export...")}
                  className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-ink shadow-sm hover:bg-slate-50"
                >
                  Download All PDFs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Grade Thresholds & Rubrics View */}
        {activeTab === "thresholds" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-line bg-white p-5">
              <h3 className="text-sm font-bold text-ink">
                Institutional Evaluation Scheme (CBSE / State Aligned)
              </h3>
              <p className="mt-1 text-xs text-muted">
                Passing criteria requires minimum 40% composite across Theory, Practicals, and Continuous Assessment.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <span className="text-xs font-bold text-emerald-800">Grade A+</span>
                  <p className="mt-1 text-lg font-bold text-ink">90% – 100%</p>
                  <p className="text-[11px] text-muted">GPA Point: 5.0 (Dean&apos;s Honor)</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <span className="text-xs font-bold text-teal-800">Grade A</span>
                  <p className="mt-1 text-lg font-bold text-ink">80% – 89.9%</p>
                  <p className="text-[11px] text-muted">GPA Point: 4.5 (High Distinction)</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <span className="text-xs font-bold text-sky-800">Grade B+</span>
                  <p className="mt-1 text-lg font-bold text-ink">70% – 79.9%</p>
                  <p className="text-[11px] text-muted">GPA Point: 4.0 (Distinction)</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <span className="text-xs font-bold text-slate-700">Grade B</span>
                  <p className="mt-1 text-lg font-bold text-ink">60% – 69.9%</p>
                  <p className="text-[11px] text-muted">GPA Point: 3.5 (Pass Credit)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Sticky Bottom Action Bar (when scholars selected) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-white/95 px-6 py-3.5 shadow-lg backdrop-blur sm:left-64">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status Label */}
          <div className="text-xs font-medium text-ink">
            <span className="font-bold">{selectedIds.size} scholars selected</span>{" "}
            • Ready for ledger action
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() =>
                triggerToast(
                  `Printing batch report cards for ${selectedIds.size} scholars...`
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <PrinterIcon width={15} height={15} className="text-slate-600" />
              <span>Print Batch Report Cards</span>
            </button>

            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() =>
                triggerToast(
                  `Published report cards for ${selectedIds.size} scholars to Parent Portal.`
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50"
            >
              <SendIcon width={14} height={14} className="text-emerald-700" />
              <span>Publish to Parent Portal</span>
            </button>

            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() =>
                triggerToast(
                  `Successfully approved grades for ${selectedIds.size} selected scholars.`
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f382c] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#064e3b] disabled:opacity-50"
            >
              <CheckIcon width={15} height={15} />
              <span>Approve Selected Grades</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Grading Criteria */}
      {showGradingCriteriaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink">
                Grading Criteria &amp; Evaluation Rubrics
              </h3>
              <button
                type="button"
                onClick={() => setShowGradingCriteriaModal(false)}
                className="text-muted hover:text-ink"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-body">
              <p>
                Academic evaluation follows the weighted term average formula:
              </p>
              <div className="rounded-xl bg-slate-50 p-3 font-mono text-[11px] text-slate-800">
                Composite = (Theory × 0.60) + (Practical/Lab × 0.25) + (Continuous
                Assessment × 0.15)
              </div>
              <ul className="list-inside list-disc space-y-1 pt-1">
                <li>A+ Tier: ≥ 90% (Distinction with Dean&apos;s Honor)</li>
                <li>A Tier: 80% – 89.9% (Distinction)</li>
                <li>B+ Tier: 70% – 79.9% (First Division)</li>
                <li>B Tier: 60% – 69.9% (Second Division)</li>
                <li>Passing Cutoff: ≥ 40% overall composite</li>
              </ul>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGradingCriteriaModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Assessment */}
      {showNewAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink">
                Schedule New Assessment
              </h3>
              <button
                type="button"
                onClick={() => setShowNewAssessmentModal(false)}
                className="text-muted hover:text-ink"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowNewAssessmentModal(false);
                triggerToast("New assessment scheduled successfully!");
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-ink">
                  Assessment Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mathematics Paper II (Geometry & Trigonometry)"
                  className="mt-1 w-full rounded-xl border border-line p-2 text-ink shadow-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Grade</label>
                  <select className="mt-1 w-full rounded-xl border border-line p-2 text-ink shadow-sm focus:border-emerald-600 focus:outline-none">
                    {GRADE_FILTER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink">Subject</label>
                  <select className="mt-1 w-full rounded-xl border border-line p-2 text-ink shadow-sm focus:border-emerald-600 focus:outline-none">
                    {SUBJECT_FILTER_OPTIONS.slice(1).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink">Date</label>
                  <input
                    type="date"
                    required
                    defaultValue="2026-11-05"
                    className="mt-1 w-full rounded-xl border border-line p-2 text-ink shadow-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink">
                    Max Marks
                  </label>
                  <input
                    type="number"
                    defaultValue={100}
                    className="mt-1 w-full rounded-xl border border-line p-2 text-ink shadow-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewAssessmentModal(false)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0f382c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#064e3b]"
                >
                  Schedule Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
