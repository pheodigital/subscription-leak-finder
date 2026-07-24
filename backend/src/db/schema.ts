import {
  pgTable,
  serial,
  varchar,
  numeric,
  date,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

// The core table: every subscription we detect (manually added or AI-extracted) lives here
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),

  // Core subscription info
  merchant: varchar("merchant", { length: 255 }).notNull(), // e.g. "Netflix"
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // e.g. 15.99
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),

  // Renewal tracking
  renewalDate: date("renewal_date"), // next known renewal, nullable if unknown
  billingCycle: varchar("billing_cycle", { length: 20 }), // "monthly" | "yearly" | "weekly" | null if unknown

  // Categorization
  category: varchar("category", { length: 100 }), // e.g. "Streaming", "Software", "Fitness"

  // Provenance — how did this row get created?
  source: varchar("source", { length: 20 }).notNull().default("manual"), // "manual" | "email"
  sourceEmailSnippet: text("source_email_snippet"), // raw excerpt, useful for debugging AI extraction later

  // Timestamps — standard practice for every production table
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
