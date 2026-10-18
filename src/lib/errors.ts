import { NextResponse } from "next/server";
import { z } from "zod";

export class AppError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.fields = fields;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(400, message, fields);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required.") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "You do not have permission to access this resource.") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found.") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists.", fields?: Record<string, string>) {
    super(409, message, fields);
    this.name = "ConflictError";
  }
}

/**
 * Maps any thrown error to standard JSON response matching PRD requirements:
 * 400: invalid input with field-level messages
 * 401: not signed in
 * 403: no membership or role
 * 404: not found
 * 409: conflict
 * 500: server error
 * Never returns raw exceptions or stack traces to the client.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        message: error.message,
        ...(error.fields && Object.keys(error.fields).length > 0 ? { fields: error.fields } : {}),
      },
      { status: error.status },
    );
  }

  if (error instanceof z.ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      if (path && !fields[path]) {
        fields[path] = issue.message;
      }
    }
    return NextResponse.json(
      {
        message: "Invalid input data.",
        fields,
      },
      { status: 400 },
    );
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json(
    { message: "An unexpected error occurred." },
    { status: 500 },
  );
}
