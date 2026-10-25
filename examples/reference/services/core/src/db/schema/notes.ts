import { boolean, pgSchema, text, timestamp, uuid, varchar } from "@pands/db";

export const coreSchema = pgSchema("core");

export const notes = coreSchema.table("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
