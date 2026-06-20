// 1. Load environment variables
try {
  process.loadEnvFile(".env.local");
} catch (e) {}

import "./db-guard";

import { Webhook } from "svix";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function runTest() {
  console.log("=== INICIANDO PRUEBA LOCAL DE WEBHOOK CLERK ===");

  const secret = process.env.CLERK_WEBHOOK_SECRET || "whsec_dGVzdHNlY3JldGtleTEyMzQ1Njc4OTA=";
  const testUserId = "user_clerk_webhook_test_9999";
  const testEmail = "webhook_tester@consejos.com";

  // Connect to database to clean up and verify data
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  try {
    console.log("Limpiando datos de pruebas previas...");
    await sql`DELETE FROM reputation_events WHERE user_id = ${testUserId};`;
    await sql`DELETE FROM user_reputation WHERE user_id = ${testUserId};`;
    await sql`DELETE FROM profiles WHERE user_id = ${testUserId};`;
    await sql`DELETE FROM users WHERE id = ${testUserId};`;

    // 2. Mock payload for user.created
    const payload = {
      type: "user.created",
      data: {
        id: testUserId,
        email_addresses: [
          { id: "email_test_1", email_address: testEmail }
        ],
        primary_email_address_id: "email_test_1",
        first_name: "Clerk",
        last_name: "Webhook Test",
        image_url: "https://images.clerk.dev/mock-avatar.png",
        username: "clerk_tester"
      }
    };

    const body = JSON.stringify(payload);
    
    // 3. Sign the payload using Svix
    const wh = new Webhook(secret);
    const date = new Date();
    const timestamp = Math.floor(date.getTime() / 1000).toString();
    const signature = wh.sign("msg_local_test_12345", date, body);

    // 4. Send HTTP POST request to local dev server
    console.log("Enviando POST request a http://localhost:3000/api/webhooks/clerk...");
    console.log("(Asegúrate de que Next.js dev server esté corriendo en puerto 3000)");
    
    const res = await fetch("http://localhost:3000/api/webhooks/clerk", {
      method: "POST",
      body: body,
      headers: {
        "Content-Type": "application/json",
        "svix-id": "msg_local_test_12345",
        "svix-timestamp": timestamp,
        "svix-signature": signature
      }
    });

    console.log(`\nWebhook Response Status: ${res.status}`);
    const resText = await res.text();
    console.log(`Webhook Response Body: ${resText}`);

    if (res.status === 201) {
      console.log("\n✅ Webhook procesado exitosamente por el servidor Next.js.");

      // Verify DB contents
      console.log("\nVerificando datos guardados en Neon...");
      
      const userResult = await db.select().from(schema.users).where(eq(schema.users.id, testUserId));
      console.log("Usuario en DB:", userResult);

      const profileResult = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, testUserId));
      console.log("Perfil en DB:", profileResult);

      const repResult = await db.select().from(schema.userReputation).where(eq(schema.userReputation.userId, testUserId));
      console.log("Reputación en DB:", repResult);

      if (userResult.length > 0 && profileResult.length > 0 && repResult.length > 0) {
        console.log("\n✅ ÉXITO: Sincronización de Clerk -> Neon completada.");
      } else {
        console.log("\n❌ ERROR: Faltan registros en alguna de las tablas.");
      }
    } else {
      console.log("\n❌ ERROR: El webhook falló en el servidor Next.js.");
    }

  } catch (err) {
    console.error("\n❌ Ocurrió un error en el test:", err);
  } finally {
    // Clean up
    console.log("\nLimpiando datos de prueba...");
    await sql`DELETE FROM reputation_events WHERE user_id = ${testUserId};`;
    await sql`DELETE FROM user_reputation WHERE user_id = ${testUserId};`;
    await sql`DELETE FROM profiles WHERE user_id = ${testUserId};`;
    await sql`DELETE FROM users WHERE id = ${testUserId};`;
    console.log("Limpieza completada.");
  }

  console.log("=== PRUEBA WEBHOOK FINALIZADA ===");
}

runTest().catch(console.error);
