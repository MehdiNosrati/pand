import { createDb } from "@pand/db";
import * as schema from "./schema/index.js";

export type CoreDbInstance = ReturnType<typeof createCoreDb>;

export function createCoreDb(databaseUrl?: string) {
  return createDb({
    databaseUrl,
    schema,
  });
}
