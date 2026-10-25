import { createServiceApp } from "@pand/service";
import { type CoreDbInstance, createCoreDb } from "./db/index.js";
import { mountRoutes } from "./routes/index.js";
import { noteAdminMeta } from "./routes/notes.js";

export function buildCoreApp(databaseUrl?: string) {
  let dbInstance: CoreDbInstance | null = null;
  const getDbInstance = () => {
    if (!dbInstance) {
      dbInstance = createCoreDb(databaseUrl);
    }
    return dbInstance;
  };

  const app = createServiceApp({
    name: "core",
    dbHealth: () => getDbInstance().checkHealth(),
  });

  app.registerAdminEntity(noteAdminMeta);
  // pand:admin-meta

  mountRoutes(app, () => getDbInstance().db);

  return {
    app,
    closeDb: async () => {
      if (dbInstance) {
        await dbInstance.close();
      }
    },
  };
}

export const { app } = buildCoreApp();
export default app;
