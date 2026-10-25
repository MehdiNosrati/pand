import { z } from "zod";

export const ServiceNameRegex = /^[a-z][a-z0-9]{1,23}$/;
export const ProjectNameRegex = /^[a-z][a-z0-9-]{1,30}$/;
export const EntityNameRegex = /^[A-Z][a-zA-Z0-9]{1,40}$/;

export const ServiceConfigSchema = z.object({
  /** Port offset from project basePort (>= 10). Core defaults to 10, next services 11, 12... */
  portOffset: z.number().int().min(10).max(89),
  /** Whether this service owns a Postgres schema (named identically to the service key) */
  db: z.boolean().default(true),
  /** Public path prefix under /api/v1/<service> */
  routePrefix: z.string().optional(),
  /** Container memory limit in MB on the Box */
  memoryMb: z.number().int().min(64).max(2048).default(192),
});

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

export const PandConfigSchema = z.object({
  /** Lowercase slug, e.g. "todo". Used for DB names, container prefixes, and subdomains. */
  name: z.string().regex(ProjectNameRegex),
  /** Display title, e.g. "Todo App" */
  displayName: z.string().min(1),
  /** Version of @pands/* packages this project targets */
  pandVersion: z.string().default("0.1.0"),
  /** Deterministic base port in [4000, 8900] in steps of 100. Computed from hash(name) if omitted. */
  basePort: z.number().int().min(3000).max(9000).optional(),
  /** Root domain for deployments */
  domain: z.string().default("mahdins.dev"),
  /** GitHub owner for GHCR image names */
  githubOwner: z.string().default("mehdinosrati"),
  /** Reverse-DNS bundle prefix for iOS & Android */
  bundleIdPrefix: z.string().default("dev.mahdins"),
  /** Authentication settings */
  auth: z
    .object({
      emailPassword: z.boolean().default(true),
      magicLink: z.boolean().default(false),
      socialProviders: z.array(z.enum(["github", "google", "apple"])).default([]),
      adminEmails: z.array(z.string().email()).default([]),
    })
    .default({}),
  /** Shared infrastructure resources enabled for this project */
  resources: z
    .object({
      postgres: z.boolean().default(true),
      valkey: z.boolean().default(false),
      storage: z.boolean().default(false),
      events: z.boolean().default(false),
      push: z.boolean().default(false),
    })
    .default({}),
  /** Backend microservices (excluding gateway, which is always present at offset 1) */
  services: z.record(z.string().regex(ServiceNameRegex), ServiceConfigSchema),
  /** Enabled client applications */
  apps: z
    .object({
      web: z.boolean().default(true),
      admin: z.boolean().default(true),
      ios: z.boolean().default(false),
      android: z.boolean().default(false),
    })
    .default({}),
});

export type PandConfig = z.infer<typeof PandConfigSchema>;
export type PandConfigInput = z.input<typeof PandConfigSchema>;

export function defineConfig(input: PandConfigInput): PandConfig {
  return PandConfigSchema.parse(input);
}
