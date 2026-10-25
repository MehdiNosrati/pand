import { jwtVerify } from "jose";
import pg from "pg";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEST_INTERNAL_SECRET,
  createTestDatabase,
  mintTestInternalToken,
} from "../src/index.js";

describe("@pands/testing", () => {
  it("creates and cleans up an isolated Postgres test database", async () => {
    const handle = await createTestDatabase();
    try {
      expect(handle.dbName).toMatch(/^test_[0-9a-f]{12}$/);
      const client = new pg.Client({ connectionString: handle.databaseUrl });
      await client.connect();
      try {
        await client.query("CREATE TABLE items (id serial PRIMARY KEY, name text NOT NULL)");
        await client.query("INSERT INTO items (name) VALUES ('hello')");
        const res = await client.query("SELECT name FROM items");
        expect(res.rows[0]?.name).toBe("hello");
      } finally {
        await client.end();
      }
    } finally {
      await handle.cleanup();
    }
  });

  it("mints a valid HS256 internal JWT", async () => {
    const token = await mintTestInternalToken({
      sub: "user-42",
      email: "admin@mahdins.dev",
      role: "admin",
    });

    const verified = await jwtVerify(token, new TextEncoder().encode(DEFAULT_TEST_INTERNAL_SECRET));
    expect(verified.payload.sub).toBe("user-42");
    expect(verified.payload.email).toBe("admin@mahdins.dev");
    expect(verified.payload.role).toBe("admin");
    expect(verified.payload.authenticated).toBe(true);
    expect(verified.payload.caller).toBe("gateway");
  });
});
