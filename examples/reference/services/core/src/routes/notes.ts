import { desc, eq, gt, ilike } from "@pands/db";
import {
  type AdminEntityMeta,
  OpenAPIHono,
  PandError,
  type ServiceVariables,
  createRoute,
  requireAuth,
  z,
} from "@pands/service";
import type { CoreDbInstance } from "../db/index.js";
import { notes } from "../db/schema/notes.js";

export const NoteSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    body: z.string().nullable(),
    pinned: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Note");

export const CreateNoteSchema = z
  .object({
    title: z.string().min(1).max(255),
    body: z.string().nullable().optional(),
    pinned: z.boolean().optional().default(false),
  })
  .openapi("CreateNoteInput");

export const UpdateNoteSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    body: z.string().nullable().optional(),
    pinned: z.boolean().optional(),
  })
  .openapi("UpdateNoteInput");

export const NoteListResponseSchema = z
  .object({
    items: z.array(NoteSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi("NoteListResponse");

export const noteAdminMeta: AdminEntityMeta = {
  service: "core",
  entity: "Note",
  table: "notes",
  basePath: "/api/v1/core/notes",
  primaryKey: "id",
  displayField: "title",
  fields: [
    { name: "id", label: "ID", type: "uuid", required: true, readOnly: true },
    { name: "title", label: "Title", type: "string", required: true, readOnly: false },
    { name: "body", label: "Body", type: "text", required: false, readOnly: false },
    {
      name: "pinned",
      label: "Pinned",
      type: "boolean",
      required: true,
      readOnly: false,
      defaultValue: false,
    },
    { name: "createdAt", label: "Created At", type: "datetime", required: true, readOnly: true },
    { name: "updatedAt", label: "Updated At", type: "datetime", required: true, readOnly: true },
  ],
};

function serializeNote(row: typeof notes.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? null,
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createNotesRouter(getDb: () => CoreDbInstance["db"]) {
  const router = new OpenAPIHono<{ Variables: ServiceVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/notes",
    middleware: [requireAuth()] as const,
    request: {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
        q: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Paginated notes",
        content: {
          "application/json": {
            schema: NoteListResponseSchema,
          },
        },
      },
    },
  });

  router.openapi(listRoute, async (c) => {
    const { limit, cursor, q } = c.req.valid("query");
    const db = getDb();
    let rows = await db
      .select()
      .from(notes)
      .where(q ? ilike(notes.title, `%${q}%`) : cursor ? gt(notes.id, cursor) : undefined)
      .orderBy(desc(notes.createdAt))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const popped = rows.pop();
      nextCursor = popped?.id ?? null;
      rows = rows.slice(0, limit);
    }

    return c.json(
      {
        items: rows.map(serializeNote),
        nextCursor,
      },
      200,
    );
  });

  const getRoute = createRoute({
    method: "get",
    path: "/notes/{id}",
    middleware: [requireAuth()] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Note detail",
        content: {
          "application/json": {
            schema: NoteSchema,
          },
        },
      },
    },
  });

  router.openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb();
    const [row] = await db.select().from(notes).where(eq(notes.id, id));
    if (!row) {
      throw PandError.notFound(`Note ${id} not found`);
    }
    return c.json(serializeNote(row), 200);
  });

  const createNoteRoute = createRoute({
    method: "post",
    path: "/notes",
    middleware: [requireAuth()] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateNoteSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created note",
        content: {
          "application/json": {
            schema: NoteSchema,
          },
        },
      },
    },
  });

  router.openapi(createNoteRoute, async (c) => {
    const input = c.req.valid("json");
    const db = getDb();
    const [created] = await db
      .insert(notes)
      .values({
        title: input.title,
        body: input.body ?? null,
        pinned: input.pinned ?? false,
      })
      .returning();

    if (!created) {
      throw PandError.internal("Failed to create note");
    }
    return c.json(serializeNote(created), 201);
  });

  const updateNoteRoute = createRoute({
    method: "patch",
    path: "/notes/{id}",
    middleware: [requireAuth()] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: UpdateNoteSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated note",
        content: {
          "application/json": {
            schema: NoteSchema,
          },
        },
      },
    },
  });

  router.openapi(updateNoteRoute, async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const db = getDb();

    const [updated] = await db
      .update(notes)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    if (!updated) {
      throw PandError.notFound(`Note ${id} not found`);
    }
    return c.json(serializeNote(updated), 200);
  });

  const deleteNoteRoute = createRoute({
    method: "delete",
    path: "/notes/{id}",
    middleware: [requireAuth()] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Deleted note",
        content: {
          "application/json": {
            schema: z.object({ deleted: z.boolean(), id: z.string().uuid() }),
          },
        },
      },
    },
  });

  router.openapi(deleteNoteRoute, async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb();
    const [deleted] = await db.delete(notes).where(eq(notes.id, id)).returning();
    if (!deleted) {
      throw PandError.notFound(`Note ${id} not found`);
    }
    return c.json({ deleted: true, id }, 200);
  });

  return router;
}
