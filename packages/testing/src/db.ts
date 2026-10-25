import crypto from "node:crypto";
import pg from "pg";

const { Client } = pg;

export interface TestDatabaseHandle {
  databaseUrl: string;
  dbName: string;
  cleanup: () => Promise<void>;
}

export async function createTestDatabase(adminUrl?: string): Promise<TestDatabaseHandle> {
  const baseAdminUrl =
    adminUrl ?? process.env.TEST_POSTGRES_URL ?? "postgres://pand:pand@localhost:4032/postgres";
  const dbName = `test_${crypto.randomBytes(6).toString("hex")}`;

  const adminClient = new Client({ connectionString: baseAdminUrl });
  await adminClient.connect();
  try {
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminClient.end();
  }

  const parsedUrl = new URL(baseAdminUrl);
  parsedUrl.pathname = `/${dbName}`;
  const databaseUrl = parsedUrl.toString();

  const cleanup = async (): Promise<void> => {
    const dropClient = new Client({ connectionString: baseAdminUrl });
    await dropClient.connect();
    try {
      await dropClient.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [dbName],
      );
      await dropClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    } finally {
      await dropClient.end();
    }
  };

  return {
    databaseUrl,
    dbName,
    cleanup,
  };
}
