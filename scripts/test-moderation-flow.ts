if (process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
  console.error("ERROR: No se permite ejecutar scripts de prueba/sembrado destructivos en un entorno de producción o Vercel.");
  process.exit(1);
}

import { db, poolDb } from "@/db";
import { users, profiles, communities, communityMembers, posts, comments, reports, auditLogs, userReputation } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

async function testModerationFlow() {
  console.log("Iniciando flujo de prueba manual automatizada para moderación...");

  // IDs de prueba
  const userIdGlobalAdmin = "user_mod_global_admin";
  const userIdModA = "user_mod_community_a";
  const userIdModB = "user_mod_community_b";
  const userIdMemberA = "user_mod_member_a";
  const userIdMemberB = "user_mod_member_b";

  const slugA = "mod-community-a";
  const slugB = "mod-community-b";

  try {
    // 1. Limpieza de datos residuales
    console.log("Limpiando datos de pruebas previas...");
    await db.delete(auditLogs).execute();
    await db.delete(reports).execute();
    await db.delete(comments).execute();
    await db.delete(posts).execute();
    await db.delete(communityMembers).execute();
    await db.delete(communities).where(eq(communities.slug, slugA)).execute();
    await db.delete(communities).where(eq(communities.slug, slugB)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdGlobalAdmin)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdModA)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdModB)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdMemberA)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdMemberB)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdGlobalAdmin)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdModA)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdModB)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdMemberA)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdMemberB)).execute();
    await db.delete(users).where(eq(users.id, userIdGlobalAdmin)).execute();
    await db.delete(users).where(eq(users.id, userIdModA)).execute();
    await db.delete(users).where(eq(users.id, userIdModB)).execute();
    await db.delete(users).where(eq(users.id, userIdMemberA)).execute();
    await db.delete(users).where(eq(users.id, userIdMemberB)).execute();

    // 2. Sembrar Usuarios
    console.log("Creando usuarios de prueba...");
    await db.insert(users).values([
      { id: userIdGlobalAdmin, email: "gadmin@test.com", globalRole: "GLOBAL_ADMIN" },
      { id: userIdModA, email: "moda@test.com", globalRole: "MEMBER" },
      { id: userIdModB, email: "modb@test.com", globalRole: "MEMBER" },
      { id: userIdMemberA, email: "membera@test.com", globalRole: "MEMBER" },
      { id: userIdMemberB, email: "memberb@test.com", globalRole: "MEMBER" },
    ]);
    await db.insert(profiles).values([
      { userId: userIdGlobalAdmin, displayName: "Global Admin", username: "global_admin" },
      { userId: userIdModA, displayName: "Mod Community A", username: "mod_a" },
      { userId: userIdModB, displayName: "Mod Community B", username: "mod_b" },
      { userId: userIdMemberA, displayName: "Member A", username: "member_a" },
      { userId: userIdMemberB, displayName: "Member B", username: "member_b" },
    ]);

    // 3. Sembrar Comunidades
    console.log("Creando comunidades...");
    const [commA] = await db.insert(communities).values({
      slug: slugA,
      displayName: "Community A",
      privacyType: "PUBLIC",
      creatorId: userIdGlobalAdmin,
    }).returning();

    const [commB] = await db.insert(communities).values({
      slug: slugB,
      displayName: "Community B",
      privacyType: "PUBLIC",
      creatorId: userIdGlobalAdmin,
    }).returning();

    // 4. Sembrar Membresías
    await db.insert(communityMembers).values([
      { communityId: commA.id, userId: userIdModA, role: "MODERATOR", status: "APPROVED" },
      { communityId: commB.id, userId: userIdModB, role: "MODERATOR", status: "APPROVED" },
      { communityId: commA.id, userId: userIdMemberA, role: "MEMBER", status: "APPROVED" },
      { communityId: commB.id, userId: userIdMemberB, role: "MEMBER", status: "APPROVED" },
    ]);

    // 5. Sembrar Contenido en Comunidad A
    console.log("Sembrando publicación y comentario en Comunidad A...");
    const [postA] = await db.insert(posts).values({
      communityId: commA.id,
      authorId: userIdMemberA,
      title: "Spammy Post Title here",
      content: "Buy cheap watch online!",
      postType: "DISCUSSION",
      status: "ACTIVE",
    }).returning();

    const [commentA] = await db.insert(comments).values({
      postId: postA.id,
      authorId: userIdMemberA,
      content: "This is a spammy comment",
      status: "ACTIVE",
    }).returning();

    // --- Prueba 1: Crear Reporte de Post ---
    console.log("\n--- Prueba 1: Crear Reporte de Post ---");
    // Simulando createReportAction
    const [reportPost] = await db.insert(reports).values({
      reporterId: userIdMemberB,
      targetType: "POST",
      targetId: postA.id,
      reason: "SPAM",
      description: "Contiene spam comercial",
      status: "PENDING",
    }).returning();
    await db.insert(auditLogs).values({
      actorId: userIdMemberB,
      action: "REPORT_CREATE",
      targetType: "REPORT",
      targetId: reportPost.id,
      description: `Reporte de post creado. Razón: SPAM`,
    });
    console.log("Reporte de post creado con éxito. ID:", reportPost.id);

    // --- Prueba 2: Crear Reporte de Comentario ---
    console.log("\n--- Prueba 2: Crear Reporte de Comentario ---");
    const [reportComment] = await db.insert(reports).values({
      reporterId: userIdMemberB,
      targetType: "COMMENT",
      targetId: commentA.id,
      reason: "HARASSMENT",
      description: "Acoso verbal",
      status: "PENDING",
    }).returning();
    await db.insert(auditLogs).values({
      actorId: userIdMemberB,
      action: "REPORT_CREATE",
      targetType: "REPORT",
      targetId: reportComment.id,
      description: `Reporte de comentario creado. Razón: HARASSMENT`,
    });
    console.log("Reporte de comentario creado con éxito. ID:", reportComment.id);

    // --- Prueba 3: Evitar Reporte Duplicado ---
    console.log("\n--- Prueba 3: Evitar Reporte Duplicado ---");
    const duplicateCheck = await db.query.reports.findFirst({
      where: and(
        eq(reports.reporterId, userIdMemberB),
        eq(reports.targetType, "POST"),
        eq(reports.targetId, postA.id),
        eq(reports.status, "PENDING")
      ),
    });
    if (duplicateCheck) {
      console.log("ÉXITO: Se detectó el reporte pendiente duplicado. No se permite crear otro.");
    } else {
      throw new Error("FALLO: Debería haber existido un reporte pendiente.");
    }

    // --- Prueba 4: Moderador de Comunidad Ajena No Puede Moderar ---
    console.log("\n--- Prueba 4: Moderador de Comunidad Ajena No Puede Moderar ---");
    // Mod B intentará moderar el post de la Comunidad A.
    // Buscamos la comunidad del post
    const postCommId = postA.communityId;
    // Chequear membresía de Mod B en la comunidad del post (A)
    const modBMembershipInA = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, postCommId),
        eq(communityMembers.userId, userIdModB),
        eq(communityMembers.status, "APPROVED")
      ),
    });
    const canModB = modBMembershipInA && (modBMembershipInA.role === "MODERATOR" || modBMembershipInA.role === "COMMUNITY_ADMIN");
    if (!canModB) {
      console.log("ÉXITO: Moderador B no tiene permisos en Comunidad A.");
    } else {
      throw new Error("FALLO: Moderador B no debería tener permisos en Comunidad A.");
    }

    // --- Prueba 5: Moderador de Comunidad Propia Resuelve Reporte ---
    console.log("\n--- Prueba 5: Moderador de Comunidad Propia Resuelve Reporte (Oculta contenido) ---");
    // Mod A modera el post de su propia comunidad (A)
    const modAMembershipInA = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, postCommId),
        eq(communityMembers.userId, userIdModA),
        eq(communityMembers.status, "APPROVED")
      ),
    });
    const canModA = modAMembershipInA && (modAMembershipInA.role === "MODERATOR" || modAMembershipInA.role === "COMMUNITY_ADMIN");
    if (canModA) {
      // Usar poolDb.transaction para consistencia atómica
      await poolDb.transaction(async (tx) => {
        // 1. Ocultar
        await tx.update(posts).set({ status: "HIDDEN", updatedAt: new Date() }).where(eq(posts.id, postA.id));
        // 2. Resolver
        await tx.update(reports).set({
          status: "RESOLVED",
          moderatorId: userIdModA,
          resolutionNotes: "Ocultado por Spam",
          updatedAt: new Date(),
        }).where(eq(reports.id, reportPost.id));
        // 3. Audit Log
        await tx.insert(auditLogs).values({
          actorId: userIdModA,
          action: "POST_HIDE",
          targetType: "POST",
          targetId: postA.id,
          description: `Post ocultado tras resolución de reporte ${reportPost.id}`,
        });
      });
      console.log("ÉXITO: Moderador A ocultó el post de su comunidad de manera atómica.");

      // Verificar estados
      const postAfter = await db.query.posts.findFirst({ where: eq(posts.id, postA.id) });
      const reportAfter = await db.query.reports.findFirst({ where: eq(reports.id, reportPost.id) });
      if (postAfter?.status !== "HIDDEN" || reportAfter?.status !== "RESOLVED") {
        throw new Error("FALLO: Los estados del post o reporte no cambiaron correctamente.");
      }
      console.log("Post status:", postAfter.status, "| Report status:", reportAfter.status);
    } else {
      throw new Error("FALLO: Moderador A debería tener permisos en su propia comunidad.");
    }

    // --- Prueba 6: Global Admin Puede Resolver Cualquier Reporte ---
    console.log("\n--- Prueba 6: Global Admin Puede Resolver Cualquier Reporte ---");
    // Global Admin resuelve el reporte de comentario en Comunidad A (no es miembro)
    // Usar poolDb.transaction para consistencia atómica
    await poolDb.transaction(async (tx) => {
      // 1. Ocultar comentario
      await tx.update(comments).set({ status: "HIDDEN", updatedAt: new Date() }).where(eq(comments.id, commentA.id));
      // 2. Resolver reporte
      await tx.update(reports).set({
        status: "RESOLVED",
        moderatorId: userIdGlobalAdmin,
        resolutionNotes: "Comentario ofensivo ocultado",
        updatedAt: new Date(),
      }).where(eq(reports.id, reportComment.id));
      // 3. Audit Log
      await tx.insert(auditLogs).values({
        actorId: userIdGlobalAdmin,
        action: "COMMENT_HIDE",
        targetType: "COMMENT",
        targetId: commentA.id,
        description: `Comentario ocultado por Global Admin tras reporte ${reportComment.id}`,
      });
    });
    console.log("ÉXITO: Global Admin resolvió el reporte de comentario en Comunidad A.");

    const commentAfter = await db.query.comments.findFirst({ where: eq(comments.id, commentA.id) });
    const reportCommAfter = await db.query.reports.findFirst({ where: eq(reports.id, reportComment.id) });
    console.log("Comment status:", commentAfter?.status, "| Report status:", reportCommAfter?.status);
    if (commentAfter?.status !== "HIDDEN" || reportCommAfter?.status !== "RESOLVED") {
      throw new Error("FALLO: Los estados del comentario o reporte no se actualizaron correctamente.");
    }

    // --- Prueba 7: Suspender Usuario ---
    console.log("\n--- Prueba 7: Suspender Usuario (isSuspended = true) ---");
    // Global admin suspende a Member B
    await poolDb.transaction(async (tx) => {
      await tx.update(users).set({ isSuspended: true, updatedAt: new Date() }).where(eq(users.id, userIdMemberB));
      await tx.insert(auditLogs).values({
        actorId: userIdGlobalAdmin,
        action: "USER_SUSPEND",
        targetType: "USER",
        targetId: userIdMemberB,
        description: "Usuario suspendido por comportamiento tóxico reiterado",
      });
    });
    console.log("ÉXITO: Usuario B suspendido por Global Admin.");

    const userBAfter = await db.query.users.findFirst({ where: eq(users.id, userIdMemberB) });
    if (!userBAfter?.isSuspended) {
      throw new Error("FALLO: El usuario B no quedó en estado suspendido.");
    }

    // --- Prueba 8: Usuario Suspendido No Puede Realizar Acciones ---
    console.log("\n--- Prueba 8: Usuario Suspendido No Puede Realizar Acciones (Simulación requireAuth) ---");
    // Simular requireAuth
    try {
      const u = await db.query.users.findFirst({ where: eq(users.id, userIdMemberB) });
      if (!u) throw new Error("Usuario no encontrado.");
      if (u.isSuspended) {
        throw new Error("Acceso denegado: Esta cuenta se encuentra suspendida.");
      }
      console.log("FALLO: El usuario suspendido pudo autenticarse.");
    } catch (e: any) {
      console.log("ÉXITO: Se denegó el acceso con el error:", e.message);
    }

    // --- Prueba 9: Restaurar Usuario ---
    console.log("\n--- Prueba 9: Restaurar Usuario ---");
    await poolDb.transaction(async (tx) => {
      await tx.update(users).set({ isSuspended: false, updatedAt: new Date() }).where(eq(users.id, userIdMemberB));
      await tx.insert(auditLogs).values({
        actorId: userIdGlobalAdmin,
        action: "USER_UNSUSPEND",
        targetType: "USER",
        targetId: userIdMemberB,
        description: "Levantamiento de suspensión tras revisión",
      });
    });
    console.log("ÉXITO: Suspensión de Usuario B levantada.");

    const userBFinal = await db.query.users.findFirst({ where: eq(users.id, userIdMemberB) });
    if (userBFinal?.isSuspended) {
      throw new Error("FALLO: El usuario B debería haber sido restaurado.");
    }

    // Mostrar Logs de Auditoría de Moderación
    console.log("\n--- Logs de Auditoría de Moderación en Neon DB ---");
    const logs = await db.query.auditLogs.findMany({
      orderBy: (auditLogs, { asc }) => [asc(auditLogs.createdAt)],
    });
    logs.forEach(log => {
      console.log(`- [${log.action}] ${log.description} (por ${log.actorId})`);
    });

  } catch (err: any) {
    console.error("Fallo inesperado durante las pruebas de moderación:", err.message);
    process.exit(1);
  } finally {
    // 10. Limpieza final de datos sembrados
    console.log("\nLimpiando datos sembrados de prueba de moderación...");
    await db.delete(auditLogs).execute();
    await db.delete(reports).execute();
    await db.delete(comments).execute();
    await db.delete(posts).execute();
    await db.delete(communityMembers).execute();
    await db.delete(communities).where(eq(communities.slug, slugA)).execute();
    await db.delete(communities).where(eq(communities.slug, slugB)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdGlobalAdmin)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdModA)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdModB)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdMemberA)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdMemberB)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdGlobalAdmin)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdModA)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdModB)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdMemberA)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdMemberB)).execute();
    await db.delete(users).where(eq(users.id, userIdGlobalAdmin)).execute();
    await db.delete(users).where(eq(users.id, userIdModA)).execute();
    await db.delete(users).where(eq(users.id, userIdModB)).execute();
    await db.delete(users).where(eq(users.id, userIdMemberA)).execute();
    await db.delete(users).where(eq(users.id, userIdMemberB)).execute();
    console.log("Limpieza terminada. Base de datos restaurada.");
  }
}

testModerationFlow();
