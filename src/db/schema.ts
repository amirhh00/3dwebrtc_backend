import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar, boolean, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  color: varchar().default("#000000"),
  is_host: boolean("is_host").default(false),
  room_id: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
  created_at: timestamp({ withTimezone: true, mode: "string" })
    .default(sql`(now() AT TIME ZONE 'utc'::text)`)
    .notNull(),
  updated_at: timestamp({ withTimezone: true, mode: "string" })
    .default(sql`(now() AT TIME ZONE 'utc'::text)`)
    .notNull()
    .$onUpdate(() => sql`(now() AT TIME ZONE 'utc'::text)`),
});

export const rooms = pgTable("rooms", {
  id: uuid().defaultRandom().primaryKey(),
  created_at: timestamp({ withTimezone: true, mode: "string" })
    .default(sql`(now() AT TIME ZONE 'utc'::text)`)
    .notNull(),
});

export const messages = pgTable("messages", {
  id: uuid().defaultRandom().primaryKey(),
  user_id: uuid("user_id").references(() => users.id),
  room_id: uuid("room_id").references(() => rooms.id),
  content: text("content").notNull(),
  created_at: timestamp({ withTimezone: true, mode: "string" })
    .default(sql`(now() AT TIME ZONE 'utc'::text)`)
    .notNull(),
});
