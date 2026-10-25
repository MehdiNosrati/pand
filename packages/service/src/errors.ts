import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "UPSTREAM_ERROR",
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export class PandError extends Error {
  public readonly code: ErrorCode;
  public readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PandError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, unknown>): PandError {
    return new PandError("BAD_REQUEST", 400, message, details);
  }

  static validation(message: string, details?: Record<string, unknown>): PandError {
    return new PandError("VALIDATION_ERROR", 400, message, details);
  }

  static unauthorized(message = "Authentication required"): PandError {
    return new PandError("UNAUTHORIZED", 401, message);
  }

  static forbidden(message = "Forbidden"): PandError {
    return new PandError("FORBIDDEN", 403, message);
  }

  static notFound(message = "Resource not found"): PandError {
    return new PandError("NOT_FOUND", 404, message);
  }

  static conflict(message = "Resource conflict", details?: Record<string, unknown>): PandError {
    return new PandError("CONFLICT", 409, message, details);
  }

  static rateLimited(message = "Too many requests"): PandError {
    return new PandError("RATE_LIMITED", 429, message);
  }

  static internal(message = "Internal server error", details?: Record<string, unknown>): PandError {
    return new PandError("INTERNAL_ERROR", 500, message, details);
  }

  static upstream(
    message = "Upstream service error",
    details?: Record<string, unknown>,
  ): PandError {
    return new PandError("UPSTREAM_ERROR", 502, message, details);
  }
}
