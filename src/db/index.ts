import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Standard Next.js / Vercel pattern: Fallback to mock string during build time
// so that module import does not crash the build if DATABASE_URL is not set.
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://mock:mock@ep-mock-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
export type DbType = typeof db;
