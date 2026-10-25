import PgBoss from "pg-boss";
import type { z } from "zod";

export interface EventDefinition<TName extends string, TSchema extends z.ZodTypeAny> {
  name: TName;
  schema: TSchema;
}

export function defineEvent<TName extends string, TSchema extends z.ZodTypeAny>(
  name: TName,
  schema: TSchema,
): EventDefinition<TName, TSchema> {
  return { name, schema };
}

export interface CreateEventBusOptions {
  databaseUrl?: string;
  serviceName: string;
  inMemory?: boolean;
}

export interface PublishOptions {
  retryLimit?: number;
  startAfter?: Date | string;
}

export interface EventMeta {
  jobId: string;
  eventName: string;
  publishedAt: string;
}

export interface EventBus {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  publish: <TName extends string, TSchema extends z.ZodTypeAny>(
    eventDef: EventDefinition<TName, TSchema>,
    payload: z.input<TSchema>,
    options?: PublishOptions,
  ) => Promise<string>;
  subscribe: <TName extends string, TSchema extends z.ZodTypeAny>(
    eventDef: EventDefinition<TName, TSchema>,
    handler: (payload: z.output<TSchema>, meta: EventMeta) => Promise<void>,
  ) => Promise<void>;
  scheduleCron: (name: string, cronExpr: string, handler: () => Promise<void>) => Promise<void>;
}

export function createEventBus(options: CreateEventBusOptions): EventBus {
  const connectionString =
    options.databaseUrl ??
    process.env.DATABASE_URL ??
    "postgres://pand:pand@localhost:4032/reference_dev";

  const boss = options.inMemory
    ? null
    : new PgBoss({
        connectionString,
        schema: `${options.serviceName}_jobs`,
      });

  const inMemoryHandlers = new Map<
    string,
    Array<(payload: any, meta: EventMeta) => Promise<void>>
  >();
  const cronSchedules = new Map<string, { cronExpr: string; handler: () => Promise<void> }>();
  let started = false;

  return {
    async start() {
      if (started) return;
      if (boss) {
        await boss.start();
      }
      started = true;
    },

    async stop() {
      if (!started) return;
      if (boss) {
        await boss.stop({ graceful: false });
      }
      started = false;
    },

    async publish(eventDef, payload, pubOpts) {
      const parsed = eventDef.schema.parse(payload);
      const jobId = crypto.randomUUID();
      const meta: EventMeta = {
        jobId,
        eventName: eventDef.name,
        publishedAt: new Date().toISOString(),
      };

      const localHandlers = inMemoryHandlers.get(eventDef.name) ?? [];
      for (const h of localHandlers) {
        await h(parsed, meta);
      }

      if (boss && started) {
        await boss.createQueue(eventDef.name);
        const id = await boss.send(
          eventDef.name,
          { payload: parsed, meta },
          {
            retryLimit: pubOpts?.retryLimit ?? 3,
            startAfter: pubOpts?.startAfter,
          },
        );
        return id ?? jobId;
      }

      return jobId;
    },

    async subscribe(eventDef, handler) {
      const list = inMemoryHandlers.get(eventDef.name) ?? [];
      list.push(handler);
      inMemoryHandlers.set(eventDef.name, list);

      if (boss && started) {
        await boss.createQueue(eventDef.name);
        await boss.work(eventDef.name, async (jobs: any[]) => {
          for (const job of jobs) {
            const parsed = eventDef.schema.parse(job.data.payload);
            await handler(parsed, job.data.meta);
          }
        });
      }
    },

    async scheduleCron(name, cronExpr, handler) {
      cronSchedules.set(name, { cronExpr, handler });
      if (boss && started) {
        await boss.createQueue(name);
        await boss.schedule(name, cronExpr, {});
        await boss.work(name, async () => {
          await handler();
        });
      }
    },
  };
}
