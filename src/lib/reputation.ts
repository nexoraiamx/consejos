import { db } from "@/db";
import { userBadges, reputationEvents, userReputation, posts, comments } from "@/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

// Insignias y sus definiciones legibles
export const BADGE_DEFINITIONS = {
  FIRST_POST: { name: "Primer Aporte", icon: "✍️" },
  FIRST_COMMENT: { name: "Primer Comentario", icon: "💬" },
  FIRST_ACCEPTED_ANSWER: { name: "Primera Respuesta Aceptada", icon: "✅" },
  TEN_ACCEPTED_ANSWERS: { name: "Experto Resolutor", icon: "🎓" },
  TOP_CONTRIBUTOR: { name: "Colaborador Destacado", icon: "🌟" },
  COMMUNITY_FOUNDER: { name: "Fundador de Espacio", icon: "🏛️" },
  COMMUNITY_ADMIN: { name: "Administrador de Comunidad", icon: "🛡️" },
  MENTOR_LEVEL: { name: "Nivel Mentor", icon: "👑" },
  REFERENTE_LEVEL: { name: "Nivel Referente", icon: "🏆" }
};

import { getUserLevel, getLevelBadge, getLevelColor } from "./reputation-rules";
export { getUserLevel, getLevelBadge, getLevelColor };

/**
 * Otorga una insignia a un usuario si no la tiene asignada previamente.
 */
export async function awardBadgeTx(tx: any, userId: string, badgeCode: keyof typeof BADGE_DEFINITIONS) {
  const definition = BADGE_DEFINITIONS[badgeCode];
  if (!definition) return;

  // Verificar si la insignia ya fue otorgada a este usuario
  const existing = await tx.query.userBadges.findFirst({
    where: and(
      eq(userBadges.userId, userId),
      eq(userBadges.badgeCode, badgeCode)
    )
  });

  if (!existing) {
    await tx.insert(userBadges).values({
      userId,
      badgeCode,
      badgeName: definition.name,
      badgeIcon: definition.icon,
    }).execute();
  }
}

/**
 * Sincroniza la reputación en caché del usuario recalculando la suma de puntos,
 * actualizando su nivel y otorgando insignias por nivel o respuestas aceptadas.
 */
export async function syncUserReputationAndLevel(tx: any, userId: string) {
  // 1. Calcular la suma total de puntos de los eventos del usuario
  const totalPointsResult = await tx
    .select({ sum: sql<number>`coalesce(sum(points), 0)::int` })
    .from(reputationEvents)
    .where(eq(reputationEvents.userId, userId));
  const totalPoints = totalPointsResult[0]?.sum || 0;

  // 2. Mapear nivel numérico (1: Nuevo, 2: Colaborador, 3: Experto, 4: Mentor, 5: Referente)
  let numericLevel = 1;
  if (totalPoints >= 100) numericLevel = 2;
  if (totalPoints >= 500) numericLevel = 3;
  if (totalPoints >= 1500) numericLevel = 4;
  if (totalPoints >= 5000) numericLevel = 5;

  // 3. Actualizar la tabla de caché userReputation
  await tx.insert(userReputation).values({
    userId,
    score: totalPoints,
    level: numericLevel,
    updatedAt: new Date()
  })
  .onConflictDoUpdate({
    target: userReputation.userId,
    set: {
      score: totalPoints,
      level: numericLevel,
      updatedAt: new Date()
    }
  })
  .execute();

  // 4. Asignar insignias basadas en niveles/puntos acumulados
  if (totalPoints >= 100) {
    await awardBadgeTx(tx, userId, "TOP_CONTRIBUTOR");
  }
  if (totalPoints >= 1500) {
    await awardBadgeTx(tx, userId, "MENTOR_LEVEL");
  }
  if (totalPoints >= 5000) {
    await awardBadgeTx(tx, userId, "REFERENTE_LEVEL");
  }

  // 5. Asignar insignias basadas en respuestas aceptadas
  const acceptedCountResult = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .innerJoin(comments, eq(posts.acceptedAnswerId, comments.id))
    .where(
      and(
        eq(comments.authorId, userId),
        isNull(comments.deletedAt),
        isNull(posts.deletedAt)
      )
    );

  const acceptedCount = acceptedCountResult[0]?.count || 0;
  if (acceptedCount >= 1) {
    await awardBadgeTx(tx, userId, "FIRST_ACCEPTED_ANSWER");
  }
  if (acceptedCount >= 10) {
    await awardBadgeTx(tx, userId, "TEN_ACCEPTED_ANSWERS");
  }
}

/**
 * Asigna automáticamente la insignia de FIRST_POST si el usuario tiene al menos 1 post.
 */
export async function checkAndAwardFirstPostBadge(tx: any, userId: string) {
  const postsCountResult = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), isNull(posts.deletedAt)));
  const postsCount = postsCountResult[0]?.count || 0;
  if (postsCount >= 1) {
    await awardBadgeTx(tx, userId, "FIRST_POST");
  }
}

/**
 * Asigna automáticamente la insignia de FIRST_COMMENT si el usuario tiene al menos 1 comentario.
 */
export async function checkAndAwardFirstCommentBadge(tx: any, userId: string) {
  const commentsCountResult = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(and(eq(comments.authorId, userId), isNull(comments.deletedAt)));
  const commentsCount = commentsCountResult[0]?.count || 0;
  if (commentsCount >= 1) {
    await awardBadgeTx(tx, userId, "FIRST_COMMENT");
  }
}
