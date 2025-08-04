import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.js",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  dialect: "postgresql",
  verbose: true,
  strict: true,
});
