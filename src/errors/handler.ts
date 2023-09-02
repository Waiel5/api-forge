import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError, InternalError } from "./types";
import { ZodError } from "zod";

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

function buildResponse(
  err: AppError,
  includeStack: boolean
): ErrorResponseBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      ...(includeStack && err.stack ? { stack: err.stack } : {}),
    },
  };
}

function handleZodError(err: ZodError): AppError {
  const details = err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
  return new AppError("Validation failed", 422, "VALIDATION_ERROR", details);
}

/**
 * Register a global error handler on the Fastify instance.
 * Converts known error types into structured JSON responses.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  const isDev =
    process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

  app.setErrorHandler(
    (
      error: FastifyError | Error,
      _request: FastifyRequest,
      reply: FastifyReply
    ) => {
      // Already an AppError — send it directly
      if (error instanceof AppError) {
        const body = buildResponse(error, isDev);
        return reply.status(error.statusCode).send(body);
      }

      // Zod validation errors
      if (error instanceof ZodError) {
        const appErr = handleZodError(error);
        return reply.status(appErr.statusCode).send(buildResponse(appErr, isDev));
      }

      // Fastify-level validation (JSON Schema, content type, etc.)
      if ("validation" in error && (error as FastifyError).validation) {
        const details = (error as FastifyError).validation;
        const appErr = new AppError(
          "Request validation failed",
          400,
          "VALIDATION_ERROR",
          details
        );
        return reply.status(400).send(buildResponse(appErr, isDev));
      }

      // Fastify status-code errors (e.g. 404 from unknown routes)
      if ("statusCode" in error) {
        const statusCode = (error as FastifyError).statusCode ?? 500;
        const appErr = new AppError(
          error.message,
          statusCode,
          statusCode === 404 ? "NOT_FOUND" : "REQUEST_ERROR"
        );
        return reply.status(statusCode).send(buildResponse(appErr, isDev));
      }

      // Unexpected errors
      const internal = new InternalError(
        isDev ? error.message : "Internal server error"
      );
      app.log.error(error, "Unhandled error");
      return reply.status(500).send(buildResponse(internal, isDev));
    }
  );

  // Custom 404 handler
  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    const appErr = new AppError("Route not found", 404, "NOT_FOUND");
    return reply.status(404).send(buildResponse(appErr, false));
  });
}
