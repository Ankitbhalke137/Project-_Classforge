/**
 * Service layer for exam and grade operations.
 *
 * Wraps `schoolApi` so screens and the report-card endpoint share one place for
 * building requests and shaping responses. The real backend will own the
 * authorization; here we only shape the calls.
 */

import { schoolApi } from "@/lib/api";
import type { Exam, ExamResult, ReportCard } from "@/types";

export const examService = {
  /** List exams for a school. Students pass `mine: true` + their email to see
   *  only their own published results; staff see everything. */
  listExams: (
    schoolSlug: string,
    params: {
      page?: number;
      search?: string;
      term?: string;
      status?: string;
      classId?: string;
      mine?: boolean;
      email?: string;
    } = {},
  ) => schoolApi.listExams(schoolSlug, params),

  /** Results for one exam (staff view of a whole class). */
  getExamResults: (schoolSlug: string, examId: string) =>
    schoolApi.getExamResults(schoolSlug, examId),

  /** Publish an exam's results (staff only). */
  publishExam: (schoolSlug: string, examId: string) =>
    schoolApi.publishExam(schoolSlug, examId),

  /** The signed-in student's own report card for a term. The student id is
   *  resolved from the session by the backend, never accepted from the client. */
  getOwnReportCard: (schoolSlug: string, params: { term: string }) =>
    schoolApi.getReportCard(schoolSlug, "me", params),

  /** A class's report cards for a published term (staff only). */
  listClassReportCards: (schoolSlug: string, params: { classId: string; term: string }) =>
    schoolApi.listReportCards(schoolSlug, params),
};

export type { Exam, ExamResult, ReportCard };
