import { boolean, pgSchema, text, timestamp, varchar } from "@pands/db";
import pg from "pg";

export const authSchema = pgSchema("auth");

export const user = authSchema.table("user", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: varchar("role", { length: 32 }).notNull().default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = authSchema.table("session", {
  id: varchar("id", { length: 128 }).primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: varchar("ip_address", { length: 128 }),
  userAgent: text("user_agent"),
  userId: varchar("user_id", { length: 128 }).notNull(),
  impersonatedBy: varchar("impersonated_by", { length: 128 }),
});

export const account = authSchema.table("account", {
  id: varchar("id", { length: 128 }).primaryKey(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 128 }).notNull(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = authSchema.table("verification", {
  id: varchar("id", { length: 128 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const authTables = {
  user,
  session,
  account,
  verification,
};

export const AUTH_SCHEMA_DDL = `
CREATE SCHEMA IF NOT EXISTS "auth";
CREATE TABLE IF NOT EXISTS "auth"."user" (
  "id" varchar(128) PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "role" varchar(32) DEFAULT 'user' NOT NULL,
  "banned" boolean DEFAULT false,
  "ban_reason" text,
  "ban_expires" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "auth"."session" (
  "id" varchar(128) PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "token" varchar(255) UNIQUE NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" varchar(128),
  "user_agent" text,
  "user_id" varchar(128) NOT NULL,
  "impersonated_by" varchar(128)
);
CREATE TABLE IF NOT EXISTS "auth"."account" (
  "id" varchar(128) PRIMARY KEY NOT NULL,
  "account_id" varchar(255) NOT NULL,
  "provider_id" varchar(128) NOT NULL,
  "user_id" varchar(128) NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "auth"."verification" (
  "id" varchar(128) PRIMARY KEY NOT NULL,
  "identifier" varchar(255) NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
`;

export async function ensureAuthTables(databaseUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(AUTH_SCHEMA_DDL);
  } finally {
    await client.end();
  }
}
