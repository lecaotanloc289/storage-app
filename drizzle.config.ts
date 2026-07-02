import { defineConfig } from "drizzle-kit";

// D1 is SQLite. `drizzle-kit generate` reads the schema and emits SQL migrations
// into ./drizzle, which Wrangler applies via `wrangler d1 migrations apply DB`.
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
