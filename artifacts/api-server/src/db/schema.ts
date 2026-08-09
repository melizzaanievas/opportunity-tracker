import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const opportunitiesTable = sqliteTable("opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().default("other"),
  status: text("status").notNull().default("to-apply"),
  deadline: text("deadline"),
  summary: text("summary"),
  keyActionSteps: text("key_action_steps"),
  createdAt: text("created_at").notNull(),
});

export const tasksTable = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id")
    .notNull()
    .references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const settingsTable = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
