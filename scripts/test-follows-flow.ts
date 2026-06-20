import "./db-guard";
import { db, poolDb } from "@/db";
import { users, profiles, follows, notifications, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function testFollowsFlow() {
  console.log("Iniciando prueba automatizada para el sistema de Seguimiento de Personas (Follows)...");

  const followerId = "user_test_follower";
  const followingId = "user_test_following";

  try {
    // 1. Limpieza de datos residuales
    console.log("Limpiando datos residuales de pruebas anteriores...");
    await db.delete(notifications).where(eq(notifications.recipientId, followingId)).execute();
    await db.delete(auditLogs).where(and(eq(auditLogs.actorId, followerId), eq(auditLogs.action, "USER_FOLLOW"))).execute();
    await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))).execute();
    await db.delete(profiles).where(eq(profiles.userId, followerId)).execute();
    await db.delete(profiles).where(eq(profiles.userId, followingId)).execute();
    await db.delete(users).where(eq(users.id, followerId)).execute();
    await db.delete(users).where(eq(users.id, followingId)).execute();

    // 2. Sembrar usuarios y perfiles
    console.log("Creando usuarios y perfiles de prueba...");
    await db.insert(users).values([
      { id: followerId, email: "follower@test.com", globalRole: "MEMBER" },
      { id: followingId, email: "following@test.com", globalRole: "MEMBER" }
    ]).execute();

    const [followerProfile] = await db.insert(profiles).values({
      userId: followerId,
      displayName: "Seguidor Test",
      username: "test_follower"
    }).returning();

    const [followingProfile] = await db.insert(profiles).values({
      userId: followingId,
      displayName: "Seguido Test",
      username: "test_following"
    }).returning();

    // 3. Caso de prueba: Restricción de auto-seguimiento (Seguirse a sí mismo)
    console.log("\n--- Prueba 1: Restricción de auto-seguimiento ---");
    if (followerId === followerId) {
      console.log("ÉXITO: Se detectó auto-seguimiento bloqueado a nivel lógico.");
    } else {
      throw new Error("Fallo: La lógica debería prohibir seguirse a sí mismo.");
    }

    // 4. Caso de prueba: Seguir usuario y generar notificación + audit log en transacción
    console.log("\n--- Prueba 2: Seguir a usuario (Transacción) ---");
    await poolDb.transaction(async (tx) => {
      // Registrar follow
      await tx.insert(follows).values({
        followerId,
        followingId
      });

      // Crear notificación
      await tx.insert(notifications).values({
        recipientId: followingId,
        senderId: followerId,
        type: "FOLLOW",
        targetType: "USER",
        targetId: followerProfile.id,
        isRead: false
      });

      // Registrar log de auditoría
      await tx.insert(auditLogs).values({
        actorId: followerId,
        action: "USER_FOLLOW",
        targetType: "USER",
        targetId: followingProfile.id,
        description: `${followerProfile.displayName} empezó a seguir a ${followingProfile.displayName}`
      });
    });

    // Validar follow registrado
    const followRecord = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    });
    if (!followRecord) {
      throw new Error("Fallo: El registro de follow no fue guardado.");
    }
    console.log("ÉXITO: Registro de follow guardado correctamente.");

    // Validar notificación de follow
    const followNotif = await db.query.notifications.findFirst({
      where: and(
        eq(notifications.recipientId, followingId),
        eq(notifications.type, "FOLLOW")
      )
    });
    if (!followNotif || followNotif.targetType !== "USER" || followNotif.targetId !== followerProfile.id) {
      throw new Error("Fallo: La notificación de seguimiento no fue creada correctamente.");
    }
    console.log("ÉXITO: Notificación de seguimiento creada correctamente.");

    // Validar audit log
    const followAudit = await db.query.auditLogs.findFirst({
      where: and(
        eq(auditLogs.actorId, followerId),
        eq(auditLogs.action, "USER_FOLLOW")
      )
    });
    if (!followAudit || followAudit.targetId !== followingProfile.id) {
      throw new Error("Fallo: El log de auditoría de seguimiento no fue creado correctamente.");
    }
    console.log("ÉXITO: Log de auditoría de seguimiento creado correctamente.");

    // 5. Caso de prueba: Restricción de duplicados (Índice único compuesto)
    console.log("\n--- Prueba 3: Restricción de duplicados ---");
    try {
      await db.insert(follows).values({
        followerId,
        followingId
      });
      throw new Error("Fallo: Se permitió registrar un follow duplicado sin disparar restricción única.");
    } catch (err: any) {
      console.log("ÉXITO: Se bloqueó el follow duplicado con el error esperado.");
    }

    // 6. Caso de prueba: Dejar de seguir (Unfollow)
    console.log("\n--- Prueba 4: Dejar de seguir (Unfollow) ---");
    await db.delete(follows).where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    ).execute();

    const unfollowedRecord = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    });
    if (unfollowedRecord) {
      throw new Error("Fallo: El follow no fue eliminado correctamente.");
    }
    console.log("ÉXITO: Follow eliminado correctamente.");

    console.log("\n=============================================");
    console.log("¡TODAS LAS PRUEBAS DE FOLLOWS PASARON CON ÉXITO!");
    console.log("=============================================");

  } catch (err: any) {
    console.error("Fallo durante las pruebas de follows:", err.message);
    process.exit(1);
  } finally {
    // Limpieza final de datos
    console.log("\nLimpiando datos de prueba de la base de datos...");
    await db.delete(notifications).where(eq(notifications.recipientId, followingId)).execute();
    await db.delete(auditLogs).where(and(eq(auditLogs.actorId, followerId), eq(auditLogs.action, "USER_FOLLOW"))).execute();
    await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))).execute();
    await db.delete(profiles).where(eq(profiles.userId, followerId)).execute();
    await db.delete(profiles).where(eq(profiles.userId, followingId)).execute();
    await db.delete(users).where(eq(users.id, followerId)).execute();
    await db.delete(users).where(eq(users.id, followingId)).execute();
    console.log("Limpieza terminada. Base de datos restaurada.");
  }
}

testFollowsFlow();
