import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.js",
  out: "./src/db/migrations",
  dbCredentials: {
    url: "file:./data/makethumb.db",
  },
  dialect: "sqlite",
  verbose: true,
  strict: true,
});
