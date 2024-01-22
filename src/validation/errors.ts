import { ZodError, type ZodIssue } from "zod";

export interface FormattedValidationError {
  field: string;
  message: string;
  code: string;
  expected?: unknown;
  received?: unknown;
}

/**
 * Transform a ZodError into a flat list of field-level errors suitable
 * for API consumers.
 */
export function formatZodError(error: ZodError): FormattedValidationError[] {
  return error.issues.map(issueToFormatted);
}

function issueToFormatted(issue: ZodIssue): FormattedValidationError {
  const base: FormattedValidationError = {
    field: issue.path.join(".") || "(root)",
    message: issue.message,
    code: issue.code,
  };

  if (issue.code === "invalid_type") {
    return {
      ...base,
      expected: (issue as any).expected,
      received: (issue as any).received,
    };
  }

  return base;
}

/**
 * Build a structured error response body from a ZodError.
 */
export function validationErrorResponse(error: ZodError) {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: formatZodError(error),
    },
  };
}
