import crypto from "node:crypto";
import { OpenAPIHono } from "@hono/zod-openapi";
import { type Logger, createLogger } from "@pand/logger";
import { SpanStatusCode, trace } from "@pand/telemetry";
import { type ServiceVariables, internalTokenMiddleware } from "./auth-middleware.js";
import { ErrorEnvelopeSchema, PandError } from "./errors.js";

export interface AdminFieldMeta {
  name: string;
  label: string;
  type: "uuid" | "string" | "text" | "int" | "float" | "boolean" | "datetime" | "enum";
  required: boolean;
  readOnly: boolean;
  enumValues?: string[];
  defaultValue?: unknown;
}

export interface AdminEntityMeta {
  service: string;
  entity: string;
  table: string;
  basePath: string;
  primaryKey: string;
  displayField: string;
  fields: AdminFieldMeta[];
}

export interface PaginatedList<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface CreateServiceAppOptions {
  name: string;
  version?: string;
  dbHealth?: () => Promise<string>;
  internalSecret?: string;
  logger?: Logger;
}

export type PandServiceApp = OpenAPIHono<{ Variables: ServiceVariables }> & {
  serviceName: string;
  logger: Logger;
  registerAdminEntity: (meta: AdminEntityMeta) => void;
  getAdminEntities: () => AdminEntityMeta[];
};

export function createServiceApp(options: CreateServiceAppOptions): PandServiceApp {
  const version = options.version ?? "0.1.0";
  const logger =
    options.logger ??
    createLogger({
      service: options.name,
      level: process.env.NODE_ENV === "test" ? "silent" : undefined,
    });

  const adminEntities: AdminEntityMeta[] = [];

  const app = new OpenAPIHono<{ Variables: ServiceVariables }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const requestId = c.get("requestId") ?? crypto.randomUUID();
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of result.error.issues) {
          const key = issue.path.join(".") || "_root";
          if (!fieldErrors[key]) {
            fieldErrors[key] = [];
          }
          fieldErrors[key]?.push(issue.message);
        }
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR" as const,
              message: "Request validation failed",
              requestId,
              details: { fields: fieldErrors },
            },
          },
          400,
        );
      }
      return undefined;
    },
  });

  app.use("*", async (c, next) => {
    const reqId = c.req.header("x-request-id") ?? crypto.randomUUID();
    c.set("requestId", reqId);
    c.header("x-request-id", reqId);
    const start = performance.now();
    await next();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const span = trace.getActiveSpan();
    if (span && c.res.status >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    logger.info(
      {
        requestId: reqId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
      },
      "http_request",
    );
  });

  app.use("*", internalTokenMiddleware(options.internalSecret));

  app.onError((err, c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    if (err instanceof PandError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            requestId,
            ...(err.details ? { details: err.details } : {}),
          },
        },
        err.status,
      );
    }

    logger.error({ err, requestId }, "unhandled_service_error");
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR" as const,
          message: err instanceof Error ? err.message : "Internal server error",
          requestId,
        },
      },
      500,
    );
  });

  app.notFound((c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    return c.json(
      {
        error: {
          code: "NOT_FOUND" as const,
          message: `Route ${c.req.method} ${c.req.path} not found`,
          requestId,
        },
      },
      404,
    );
  });

  app.get("/healthz", (c) => {
    return c.json({
      status: "ok",
      service: options.name,
      version,
    });
  });

  app.get("/readyz", async (c) => {
    const checks: Record<string, string> = {};
    let ready = true;
    if (options.dbHealth) {
      const dbResult = await options.dbHealth();
      checks.db = dbResult;
      if (dbResult !== "ok") {
        ready = false;
      }
    }
    return c.json(
      {
        status: ready ? "ready" : "degraded",
        service: options.name,
        checks,
      },
      ready ? 200 : 503,
    );
  });

  app.get("/openapi.json", (c) => {
    const doc = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: {
        title: `${options.name} service`,
        version,
      },
      servers: [{ url: `/api/v1/${options.name}` }],
    });
    return c.json(doc);
  });

  app.get("/_pand/meta", (c) => {
    const actor = c.get("actor");
    if (!actor) {
      throw PandError.unauthorized("Internal token required for /_pand/meta");
    }
    return c.json(adminEntities);
  });

  const enhanced = Object.assign(app, {
    serviceName: options.name,
    logger,
    registerAdminEntity(meta: AdminEntityMeta) {
      const existingIndex = adminEntities.findIndex(
        (e) => e.service === meta.service && e.entity === meta.entity,
      );
      if (existingIndex >= 0) {
        adminEntities[existingIndex] = meta;
      } else {
        adminEntities.push(meta);
      }
    },
    getAdminEntities() {
      return [...adminEntities];
    },
  });

  return enhanced;
}

export { ErrorEnvelopeSchema };
