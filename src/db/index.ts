import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not defined. Please configure your Neon connection string in your environment variables."
      );
    }
    const sql = neon(process.env.DATABASE_URL);
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

// Proxy wrapper to defer instantiation until the first query is executed.
// This prevents Next.js compilation/build failures on Vercel where DATABASE_URL is not present during build time,
// while throwing a clean and explicit runtime error if the URL is missing at execution time.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type DbType = typeof db;
