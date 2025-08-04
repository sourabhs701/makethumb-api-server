import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  avatar: text("avatar"),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  name: text("name"),
  twitterUsername: text("twitter_username"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  slug: text("slug").notNull().unique(),
  isPublic: boolean("is_public").notNull().default(false),
  gitUrl: text("git_url"),
  env: text("env"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
