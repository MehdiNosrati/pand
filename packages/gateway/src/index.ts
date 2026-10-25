import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { type PandAuthInstance, authTables, createPandAuth, resolveRequestActor } from "@pand/auth";
import { type PandConfig, resolveProjectPorts } from "@pand/config";
import { createDb } from "@pand/db";
import { createLogger } from "@pand/logger";
import { type AdminEntityMeta, PandError, serveService, signInternalToken } from "@pand/service";
import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { type ServiceOpenApiInput, mergeServiceOpenApiSpecs } from "./openapi-merge.js";

export interface PublicClientConfig {
  project: string;
  displayName: string;
  env: string;
  apiBaseUrl: string;
  authBaseUrl: string;
  posthog?: {
    publicKey: string;
    host: string;
  };
  links?: {
    grafanaUrl?: string;
    posthogUrl?: string;
    apiDocsUrl: string;
  };
}

export interface ResolvedActor {
  userId: string;
  email: string;
  role: "user" | "admin";
}

export interface CreateGatewayAppOptions {
  config: PandConfig;
  serviceUrls?: Record<string, string>;
  serviceApps?: Record<string, { fetch: (req: Request) => Response | Promise<Response> }>;
  auth?: PandAuthInstance;
  databaseUrl?: string;
  resolveSession?: (req: Request) => Promise<ResolvedActor | null>;
  authHandler?: (req: Request) => Response | Promise<Response>;
  dbHealth?: () => Promise<string>;
  internalSecret?: string;
  posthogFetch?: typeof fetch;
  staticRootDir?: string;
}

function defaultResolveSession(req: Request): Promise<ResolvedActor | null> {
  const testUserId = req.headers.get("x-test-user-id");
  if (testUserId) {
    const roleHeader = req.headers.get("x-test-user-role");
    return Promise.resolve({
      userId: testUserId,
      email: req.headers.get("x-test-user-email") ?? `${testUserId}@mahdins.dev`,
      role: roleHeader === "admin" ? "admin" : "user",
    });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer test-user:")) {
    const parts = authHeader.slice("Bearer test-user:".length).split(":");
    const userId = parts[0] || "user-1";
    const role = parts[1] === "admin" ? "admin" : "user";
    return Promise.resolve({
      userId,
      email: `${userId}@mahdins.dev`,
      role,
    });
  }
  return Promise.resolve(null);
}

export function resolveGatewayServiceUrls(
  config: PandConfig,
  explicitUrls?: Record<string, string>,
): Record<string, string> {
  if (explicitUrls) {
    return explicitUrls;
  }
  if (process.env.PAND_SERVICE_URLS) {
    return JSON.parse(process.env.PAND_SERVICE_URLS) as Record<string, string>;
  }
  const ports = resolveProjectPorts(config);
  const urls: Record<string, string> = {};
  for (const [svc, port] of Object.entries(ports.services)) {
    urls[svc] = `http://localhost:${port}`;
  }
  return urls;
}

export function createGatewayApp(options: CreateGatewayAppOptions) {
  const { config } = options;
  const serviceUrls = resolveGatewayServiceUrls(config, options.serviceUrls);

  let lazyAuth: PandAuthInstance | null = options.auth ?? null;
  const getAuth = (): PandAuthInstance | null => {
    if (lazyAuth) return lazyAuth;
    const dbUrl = options.databaseUrl ?? process.env.DATABASE_URL;
    if (!dbUrl) return null;
    const dbInstance = createDb({ databaseUrl: dbUrl, schema: authTables });
    lazyAuth = createPandAuth({ db: dbInstance.db, config });
    return lazyAuth;
  };

  const resolveSession =
    options.resolveSession ??
    (async (req: Request) => {
      const auth = getAuth();
      if (auth) {
        return await resolveRequestActor(auth, req);
      }
      return await defaultResolveSession(req);
    });

  const authHandler =
    options.authHandler ??
    (async (req: Request) => {
      const auth = getAuth();
      if (!auth) {
        throw PandError.notFound("Auth handler is not configured on this gateway");
      }
      return await auth.handler(req);
    });

  const logger = createLogger({
    service: "gateway",
    project: config.name,
    level: process.env.NODE_ENV === "test" ? "silent" : undefined,
  });

  const app = new Hono<{ Variables: { requestId: string } }>();

  app.use("*", async (c, next) => {
    const reqId = c.req.header("x-request-id") ?? crypto.randomUUID();
    c.set("requestId", reqId);
    c.header("x-request-id", reqId);
    await next();
  });

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
    logger.error({ err, requestId }, "gateway_unhandled_error");
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Internal gateway error",
          requestId,
        },
      },
      500,
    );
  });

  const callService = async (serviceName: string, pathAndQuery: string, init?: RequestInit) => {
    const inProcess = options.serviceApps?.[serviceName];
    if (inProcess) {
      const req = new Request(`http://${serviceName}.internal${pathAndQuery}`, init);
      return await inProcess.fetch(req);
    }
    const baseUrl = serviceUrls[serviceName];
    if (!baseUrl) {
      throw PandError.notFound(`Unknown service "${serviceName}"`);
    }
    return await fetch(`${baseUrl.replace(/\/$/, "")}${pathAndQuery}`, init);
  };

  app.get("/healthz", (c) => {
    return c.json({
      status: "ok",
      service: "gateway",
      version: config.pandVersion,
    });
  });

  app.get("/readyz", async (c) => {
    const checks: Record<string, string> = {};
    let ready = true;
    if (options.dbHealth) {
      const dbStatus = await options.dbHealth();
      checks.db = dbStatus;
      if (dbStatus !== "ok") {
        ready = false;
      }
    } else {
      checks.db = "ok";
    }
    return c.json(
      {
        status: ready ? "ready" : "degraded",
        service: "gateway",
        checks,
      },
      ready ? 200 : 503,
    );
  });

  app.get("/api/config", (c) => {
    const env = process.env.PAND_ENV ?? "dev";
    const ports = resolveProjectPorts(config);
    const posthogKey = process.env.POSTHOG_PUBLIC_KEY;
    const grafanaUrl =
      env === "prod" ? `https://grafana.${config.domain}` : `http://localhost:${ports.grafanaPort}`;

    const clientConfig: PublicClientConfig = {
      project: config.name,
      displayName: config.displayName,
      env,
      apiBaseUrl: "/api",
      authBaseUrl: "/api/auth",
      ...(posthogKey
        ? {
            posthog: {
              publicKey: posthogKey,
              host: "/ingest",
            },
          }
        : {}),
      links: {
        grafanaUrl,
        posthogUrl: "https://eu.posthog.com",
        apiDocsUrl: "/api/docs",
      },
    };
    return c.json(clientConfig);
  });

  app.all("/api/auth/*", async (c) => {
    return await authHandler(c.req.raw);
  });

  app.get("/api/openapi.json", async (c) => {
    const specs = await Promise.all(
      Object.keys(config.services).map(async (service) => {
        try {
          const res = await callService(service, "/openapi.json");
          if (!res.ok) {
            return { service, spec: { paths: {}, components: { schemas: {} } } };
          }
          const spec = (await res.json()) as Record<string, any>;
          return { service, spec };
        } catch {
          return { service, spec: { paths: {}, components: { schemas: {} } } };
        }
      }),
    );

    const merged = mergeServiceOpenApiSpecs(specs, {
      title: `${config.displayName} API`,
      version: config.pandVersion,
    });
    return c.json(merged);
  });

  app.get(
    "/api/docs",
    apiReference({
      spec: {
        url: "/api/openapi.json",
      },
    }),
  );

  app.get("/api/admin/meta", async (c) => {
    const actor = await resolveSession(c.req.raw);
    if (!actor) {
      throw PandError.unauthorized("Authentication required");
    }
    if (actor.role !== "admin") {
      throw PandError.forbidden("Admin role required");
    }

    const reqId = c.get("requestId");
    const internalToken = await signInternalToken(
      {
        sub: actor.userId,
        authenticated: true,
        email: actor.email,
        role: actor.role,
        caller: "gateway",
        reqId,
      },
      options.internalSecret,
    );

    const allMeta: AdminEntityMeta[] = [];
    for (const service of Object.keys(config.services)) {
      try {
        const res = await callService(service, "/_pand/meta", {
          headers: {
            "x-pand-internal-token": internalToken,
            "x-request-id": reqId,
          },
        });
        if (res.ok) {
          const body = (await res.json()) as AdminEntityMeta[] | { entities: AdminEntityMeta[] };
          const items = Array.isArray(body) ? body : (body.entities ?? []);
          allMeta.push(...items);
        }
      } catch (err) {
        logger.warn({ err, service }, "failed_fetching_service_admin_meta");
      }
    }

    return c.json(allMeta);
  });

  const proxyServiceHandler = async (c: any) => {
    const serviceName = c.req.param("service") as string;
    if (!config.services[serviceName]) {
      throw PandError.notFound(`Service "${serviceName}" not found`);
    }

    const reqId = c.get("requestId") as string;
    const sessionActor = await resolveSession(c.req.raw);

    const internalToken = await signInternalToken(
      sessionActor
        ? {
            sub: sessionActor.userId,
            authenticated: true,
            email: sessionActor.email,
            role: sessionActor.role,
            caller: "gateway",
            reqId,
          }
        : {
            sub: "anonymous",
            authenticated: false,
            caller: "gateway",
            reqId,
          },
      options.internalSecret,
    );

    const url = new URL(c.req.url);
    const prefix = `/api/v1/${serviceName}`;
    const strippedPathname = url.pathname.startsWith(prefix)
      ? url.pathname.slice(prefix.length) || "/"
      : url.pathname;
    const targetPathAndQuery = `${strippedPathname}${url.search}`;

    const headers = new Headers();
    const contentType = c.req.header("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }
    const accept = c.req.header("accept");
    if (accept) {
      headers.set("accept", accept);
    }
    const traceparent = c.req.header("traceparent");
    if (traceparent) {
      headers.set("traceparent", traceparent);
    }
    headers.set("x-request-id", reqId);
    headers.set("x-pand-internal-token", internalToken);

    const method = c.req.method;
    const hasBody = method !== "GET" && method !== "HEAD";
    const bodyBuffer = hasBody ? await c.req.arrayBuffer() : undefined;

    let upstreamRes: Response;
    try {
      upstreamRes = await callService(serviceName, targetPathAndQuery, {
        method,
        headers,
        body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      });
    } catch (err) {
      throw PandError.upstream(`Failed to reach service "${serviceName}"`, {
        cause: err instanceof Error ? err.message : String(err),
      });
    }

    const resHeaders = new Headers(upstreamRes.headers);
    resHeaders.set("x-request-id", reqId);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  };

  app.all("/api/v1/:service", proxyServiceHandler);
  app.all("/api/v1/:service/*", proxyServiceHandler);

  app.all("/ingest/*", async (c) => {
    const url = new URL(c.req.url);
    const subpath = url.pathname.replace(/^\/ingest/, "");
    const isStatic = subpath.startsWith("/static/");
    const targetHost = isStatic
      ? "https://eu-assets.i.posthog.com"
      : (process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com").replace(/\/$/, "");
    const targetUrl = `${targetHost}${subpath}${url.search}`;

    const fetchFn = options.posthogFetch ?? fetch;
    const method = c.req.method;
    const hasBody = method !== "GET" && method !== "HEAD";
    const body = hasBody ? await c.req.arrayBuffer() : undefined;

    const headers = new Headers();
    const contentType = c.req.header("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }

    const upstream = await fetchFn(targetUrl, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  });

  app.notFound((c) => {
    if (process.env.PAND_SERVE_STATIC === "true" || options.staticRootDir) {
      const host = c.req.header("host") ?? "";
      const isAdminHost = host.startsWith(`${config.name}-admin.`);
      const baseStatic =
        options.staticRootDir ??
        path.resolve(process.cwd(), "public", isAdminHost ? "admin" : "web");
      const reqPath = c.req.path === "/" ? "/index.html" : c.req.path;
      const candidate = path.join(baseStatic, reqPath);
      const fallback = path.join(baseStatic, "index.html");
      const fileToServe =
        fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : fallback;
      if (fs.existsSync(fileToServe)) {
        const ext = path.extname(fileToServe);
        const mimeMap: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
        };
        return new Response(fs.readFileSync(fileToServe), {
          status: 200,
          headers: { "content-type": mimeMap[ext] ?? "application/octet-stream" },
        });
      }
    }

    const requestId = c.get("requestId") ?? crypto.randomUUID();
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: `Route ${c.req.method} ${c.req.path} not found`,
          requestId,
        },
      },
      404,
    );
  });

  return Object.assign(app, {
    serviceName: "gateway",
    logger,
    registerAdminEntity: () => {},
    getAdminEntities: () => [],
  });
}

export { mergeServiceOpenApiSpecs, serveService, type ServiceOpenApiInput };
