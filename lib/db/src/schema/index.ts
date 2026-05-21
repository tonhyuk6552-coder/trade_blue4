import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const syncData = pgTable("sync_data", {
  code: text("code").primaryKey(),
  trades: jsonb("trades").notNull().default([]),
  accounts: jsonb("accounts").notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SyncData = typeof syncData.$inferSelect;
export type InsertSyncData = typeof syncData.$inferInsert;
