import { neon, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let poolInstance: ReturnType<typeof drizzlePool<typeof schema>> | null = null;

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

export function getPoolDb() {
  if (!poolInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not defined. Please configure your Neon connection string in your environment variables."
      );
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    poolInstance = drizzlePool(pool, { schema });
  }
  return poolInstance;
}

// Proxy wrapper to defer instantiation until the first query is executed.
// This prevents Next.js compilation/build failures on Vercel where DATABASE_URL is not present during build time.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export const poolDb = new Proxy({} as ReturnType<typeof drizzlePool<typeof schema>>, {
  get(target, prop, receiver) {
    return Reflect.get(getPoolDb(), prop, receiver);
  },
});

export type DbType = typeof db;
export type PoolDbType = typeof poolDb;
