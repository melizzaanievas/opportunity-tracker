import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const opportunitiesTable = sqliteTable("opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  company: text("company"),
  type: text("type").notNull().default("other"),
  status: text("status", {
    enum: ["to-apply", "applied", "interviewing", "completed"],
  }).notNull().default("to-apply"),
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

export const preferencesTable = sqliteTable("preferences", {
  id: integer("id").primaryKey(),
  targetTitles: text("target_titles").notNull(),
  preferredLocations: text("preferred_locations").notNull(),
  preferredJobTypes: text("preferred_job_types").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const scoutJobsTable = sqliteTable("scout_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: text("source_id").notNull(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  company: text("company"),
  url: text("url").notNull().unique(),
  description: text("description"),
  location: text("location"),
  jobType: text("job_type"),
  discoveredAt: text("discovered_at").notNull(),
  status: text("status", {
    enum: ["pending", "added", "ignored"],
  }).notNull().default("pending"),
  opportunityId: integer("opportunity_id").references(() => opportunitiesTable.id, {
    onDelete: "set null",
  }),
  telegramMessageId: integer("telegram_message_id"),
  notifiedAt: text("notified_at"),
});
