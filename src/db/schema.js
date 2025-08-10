import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  avatar: text("avatar"),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  name: text("name"),
  twitterUsername: text("twitter_username"),
  github_token: text("github_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  slug: text("slug").notNull().unique(),
  is_public: boolean("is_public").notNull().default(false),
  git_url: text("git_url"),
  env: text("env"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
