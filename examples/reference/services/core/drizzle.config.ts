export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["core"],
  migrations: {
    table: "__drizzle_migrations",
    schema: "core",
  },
};
