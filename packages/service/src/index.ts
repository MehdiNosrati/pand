import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

export {
  createServiceApp,
  type AdminEntityMeta,
  type AdminFieldMeta,
  type CreateServiceAppOptions,
  type PaginatedList,
  type PandServiceApp,
} from "./app.js";

export {
  internalTokenMiddleware,
  requireAdmin,
  requireAuth,
  requirePublic,
  type ServiceVariables,
} from "./auth-middleware.js";

export {
  createServiceClient,
  resolveServiceUrl,
  type ServiceClient,
  type ServiceClientOptions,
} from "./client.js";

export {
  ErrorCodeSchema,
  ErrorEnvelopeSchema,
  PandError,
  type ErrorCode,
  type ErrorEnvelope,
} from "./errors.js";

export {
  DEFAULT_DEV_INTERNAL_SECRET,
  getInternalSecret,
  signInternalToken,
  verifyInternalToken,
  type InternalTokenClaims,
} from "./internal-jwt.js";

export {
  serveService,
  type ServeServiceOptions,
} from "./serve.js";

export { createRoute, OpenAPIHono, z };
