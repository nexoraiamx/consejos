if (process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
  console.error("ERROR: No se permite ejecutar scripts de prueba/sembrado destructivos en un entorno de producción o Vercel.");
  process.exit(1);
}

import { db } from "@/db";
import { users, profiles, communities, communityMembers, posts, comments, reputationEvents, userReputation, userBadges } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { 
  syncUserReputationAndLevel, 
  checkAndAwardFirstPostBadge, 
  checkAndAwardFirstCommentBadge,
  awardBadgeTx
} from "@/lib/reputation";

async function testReputationFlow() {
  console.log("Iniciando prueba automatizada para el sistema de Reputación e Insignias...");

  const userId = "user_test_rep";
  const communitySlug = "test-community-rep";

  try {
    // 1. Limpieza de datos residuales
    console.log("Limpiando datos residuales de pruebas anteriores...");
    await db.delete(userBadges).where(eq(userBadges.userId, userId)).execute();
    await db.delete(reputationEvents).where(eq(reputationEvents.userId, userId)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userId)).execute();
    await db.delete(comments).where(eq(comments.authorId, userId)).execute();
    await db.delete(posts).where(eq(posts.authorId, userId)).execute();
    await db.delete(communityMembers).where(eq(communityMembers.userId, userId)).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userId)).execute();
    await db.delete(users).where(eq(users.id, userId)).execute();

    // 2. Sembrar usuario y perfil de prueba
    console.log("Creando usuario y perfil de prueba...");
    await db.insert(users).values({ id: userId, email: "rep@test.com", globalRole: "MEMBER" }).execute();
    await db.insert(profiles).values({ userId: userId, displayName: "Test Rep", username: "test_rep" }).execute();

    // 3. Crear comunidad de prueba
    console.log("Creando comunidad de prueba...");
    const [community] = await db.insert(communities).values({
      slug: communitySlug,
      displayName: "Reputation Community",
      privacyType: "PUBLIC",
      creatorId: userId,
    }).returning();

    // 4. Registrar membresía
    await db.insert(communityMembers).values({
      communityId: community.id,
      userId: userId,
      role: "COMMUNITY_ADMIN",
      status: "APPROVED",
    }).execute();

    // --- PRUEBA 1: Sincronización inicial (0 puntos) ---
    console.log("\n--- Prueba 1: Sincronización Inicial (0 pts) ---");
    await syncUserReputationAndLevel(db, userId);
    
    const repInitial = await db.query.userReputation.findFirst({
      where: eq(userReputation.userId, userId),
    });
    console.log("Puntaje inicial:", repInitial?.score, "| Nivel:", repInitial?.level);
    if (!repInitial || repInitial.score !== 0 || repInitial.level !== 1) {
      throw new Error("Fallo en sincronización inicial. Debería ser 0 pts y Nivel 1.");
    }
    console.log("ÉXITO: Puntaje inicial correcto.");

    // --- PRUEBA 2: Acumular puntos y pasar a nivel 2 (Colaborador Destacado) ---
    console.log("\n--- Prueba 2: Superar los 100 puntos y ganar insignia TOP_CONTRIBUTOR ---");
    await db.insert(reputationEvents).values([
      { userId, eventType: "POST_UPVOTED", points: 50, sourceType: "POST" },
      { userId, eventType: "COMMENT_UPVOTED", points: 60, sourceType: "COMMENT" },
    ]).execute();

    await syncUserReputationAndLevel(db, userId);

    const repLevel2 = await db.query.userReputation.findFirst({
      where: eq(userReputation.userId, userId),
    });
    console.log("Puntaje actual:", repLevel2?.score, "| Nivel:", repLevel2?.level);
    if (!repLevel2 || repLevel2.score !== 110 || repLevel2.level !== 2) {
      throw new Error("Fallo al actualizar a nivel 2. Debería ser 110 pts y Nivel 2.");
    }

    const badgesLevel2 = await db.query.userBadges.findMany({
      where: eq(userBadges.userId, userId),
    });
    console.log("Insignias ganadas:", badgesLevel2.map(b => b.badgeCode));
    if (!badgesLevel2.some(b => b.badgeCode === "TOP_CONTRIBUTOR")) {
      throw new Error("Fallo: El usuario debería tener la insignia TOP_CONTRIBUTOR.");
    }
    console.log("ÉXITO: Se actualizó nivel y se otorgó insignia por puntaje.");

    // --- PRUEBA 3: Superar los 1,500 puntos (Nivel Mentor) ---
    console.log("\n--- Prueba 3: Superar 1,500 puntos y ganar insignia MENTOR_LEVEL ---");
    await db.insert(reputationEvents).values({
      userId,
      eventType: "ADMIN_BONUS",
      points: 1400,
      sourceType: "SYSTEM"
    }).execute();

    await syncUserReputationAndLevel(db, userId);

    const repLevel4 = await db.query.userReputation.findFirst({
      where: eq(userReputation.userId, userId),
    });
    console.log("Puntaje actual:", repLevel4?.score, "| Nivel:", repLevel4?.level);
    if (!repLevel4 || repLevel4.score !== 1510 || repLevel4.level !== 4) {
      throw new Error("Fallo al actualizar a nivel 4. Debería ser 1510 pts y Nivel 4.");
    }

    const badgesLevel4 = await db.query.userBadges.findMany({
      where: eq(userBadges.userId, userId),
    });
    console.log("Insignias ganadas:", badgesLevel4.map(b => b.badgeCode));
    if (!badgesLevel4.some(b => b.badgeCode === "MENTOR_LEVEL")) {
      throw new Error("Fallo: El usuario debería tener la insignia MENTOR_LEVEL.");
    }
    console.log("ÉXITO: Se actualizó a rango Mentor.");

    // --- PRUEBA 4: Primer Aporte (FIRST_POST) ---
    console.log("\n--- Prueba 4: Crear primer aporte y recibir FIRST_POST ---");
    await db.insert(posts).values({
      communityId: community.id,
      authorId: userId,
      title: "Publicación de Prueba Rep",
      content: "Contenido de prueba.",
      postType: "DISCUSSION",
      status: "ACTIVE"
    }).execute();

    await checkAndAwardFirstPostBadge(db, userId);

    const badgesPost = await db.query.userBadges.findMany({
      where: eq(userBadges.userId, userId),
    });
    console.log("Insignias ganadas:", badgesPost.map(b => b.badgeCode));
    if (!badgesPost.some(b => b.badgeCode === "FIRST_POST")) {
      throw new Error("Fallo: El usuario debería haber ganado FIRST_POST.");
    }
    console.log("ÉXITO: Insignia FIRST_POST otorgada.");

    // --- PRUEBA 5: Primer Comentario (FIRST_COMMENT) ---
    console.log("\n--- Prueba 5: Crear primer comentario y recibir FIRST_COMMENT ---");
    const [testPost] = await db.select().from(posts).where(eq(posts.authorId, userId)).limit(1);
    await db.insert(comments).values({
      postId: testPost.id,
      authorId: userId,
      content: "Mi primer comentario de prueba.",
      status: "ACTIVE"
    }).execute();

    await checkAndAwardFirstCommentBadge(db, userId);

    const badgesComment = await db.query.userBadges.findMany({
      where: eq(userBadges.userId, userId),
    });
    console.log("Insignias ganadas:", badgesComment.map(b => b.badgeCode));
    if (!badgesComment.some(b => b.badgeCode === "FIRST_COMMENT")) {
      throw new Error("Fallo: El usuario debería haber ganado FIRST_COMMENT.");
    }
    console.log("ÉXITO: Insignia FIRST_COMMENT otorgada.");

    console.log("\n=============================================");
    console.log("¡TODAS LAS PRUEBAS DE REPUTACIÓN PASARON CON ÉXITO!");
    console.log("=============================================");

  } catch (err: any) {
    console.error("Fallo durante las pruebas de reputación:", err.message);
    process.exit(1);
  } finally {
    // Limpieza final de datos sembrados
    console.log("\nLimpiando datos sembrados de la base de datos...");
    await db.delete(userBadges).where(eq(userBadges.userId, userId)).execute();
    await db.delete(reputationEvents).where(eq(reputationEvents.userId, userId)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userId)).execute();
    await db.delete(comments).where(eq(comments.authorId, userId)).execute();
    await db.delete(posts).where(eq(posts.authorId, userId)).execute();
    await db.delete(communityMembers).where(eq(communityMembers.userId, userId)).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userId)).execute();
    await db.delete(users).where(eq(users.id, userId)).execute();
    console.log("Limpieza terminada. Base de datos restaurada.");
  }
}

testReputationFlow();
