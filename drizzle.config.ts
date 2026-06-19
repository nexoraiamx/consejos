import { defineConfig } from "drizzle-kit";

// Load local environment variables for Drizzle Kit (Node 20+)
try {
  process.loadEnvFile(".env.local");
} catch (e) {
  // Fallback if .env.local is missing
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
