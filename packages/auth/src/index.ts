export {
  AUTH_SCHEMA_DDL,
  account,
  authSchema,
  authTables,
  ensureAuthTables,
  session,
  user,
  verification,
} from "./schema.js";

export {
  createPandAuth,
  isAdminEmail,
  resolveRequestActor,
  type CreatePandAuthOptions,
  type PandAuthInstance,
  type RequestActor,
} from "./server.js";

export {
  createPandAuthClient,
  type PandAuthClient,
} from "./client.js";
