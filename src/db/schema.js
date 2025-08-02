import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  avatar: text("avatar"),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  name: text("name"),
  twitter_username: text("twitter_username"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  user_id: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  slug: text("slug").notNull().unique(),
  is_public: integer("is_public").default(0),
  git_url: text("git_url"),
  env: text("env"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
