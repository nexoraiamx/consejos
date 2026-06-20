import { db } from "../src/db";
import { auditLogs } from "../src/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  console.log("=== AUDIT LOGS ===");
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50);
  console.log(logs);
}

main().catch(console.error);
