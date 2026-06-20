import "./db-guard";
import { db, poolDb } from "../src/db";
import { 
  users, 
  profiles, 
  communities, 
  communityMembers, 
  posts, 
  comments, 
  attachments, 
  reports, 
  notifications, 
  reputationEvents, 
  userReputation, 
  auditLogs,
  invitations,
  joinRequests
} from "../src/db/schema";
import { eq, inArray, or } from "drizzle-orm";

async function removeDemoData() {
  console.log("====================================================");
  console.log("Iniciando eliminación de datos demo de Producción...");
  console.log("====================================================");

  const demoUserIds = ["demo_admin_clerk_id", "demo_cadmin_clerk_id", "demo_member_clerk_id"];
  const demoCommunitySlug = "comunidad-demo";

  try {
    await poolDb.transaction(async (tx) => {
      // 1. Obtener la comunidad demo para recolectar IDs
      const demoComm = await tx.query.communities.findFirst({
        where: eq(communities.slug, demoCommunitySlug)
      });
      const demoCommId = demoComm?.id;

      // 2. Obtener IDs de posts en la comunidad demo
      let demoPostIds: string[] = [];
      if (demoCommId) {
        const commPosts = await tx.query.posts.findMany({
          columns: { id: true },
          where: eq(posts.communityId, demoCommId)
        });
        demoPostIds = commPosts.map(p => p.id);
      }

      // 3. Eliminar eventos de reputación
      console.log("- Eliminando eventos de reputación...");
      await tx.delete(reputationEvents)
        .where(inArray(reputationEvents.userId, demoUserIds))
        .execute();

      // 4. Eliminar reputación de usuarios
      console.log("- Eliminando reputación de usuarios demo...");
      await tx.delete(userReputation)
        .where(inArray(userReputation.userId, demoUserIds))
        .execute();

      // 5. Eliminar reportes asociados a posts demo o hechos por usuarios demo
      console.log("- Eliminando reportes...");
      const reportConditions = [inArray(reports.reporterId, demoUserIds)];
      if (demoPostIds.length > 0) {
        reportConditions.push(
          inArray(reports.targetId, demoPostIds)
        );
      }
      await tx.delete(reports)
        .where(or(...reportConditions))
        .execute();

      // 6. Eliminar notificaciones enviadas/recibidas por usuarios demo
      console.log("- Eliminando notificaciones...");
      await tx.delete(notifications)
        .where(
          or(
            inArray(notifications.recipientId, demoUserIds),
            inArray(notifications.senderId, demoUserIds)
          )
        )
        .execute();

      // 7. Eliminar logs de auditoría de usuarios demo o de la comunidad demo
      console.log("- Eliminando logs de auditoría...");
      const auditConditions = [inArray(auditLogs.actorId, demoUserIds)];
      if (demoCommId) {
        auditConditions.push(eq(auditLogs.targetId, demoCommId));
      }
      await tx.delete(auditLogs)
        .where(or(...auditConditions))
        .execute();

      // 8. Eliminar invitaciones de usuarios demo o de la comunidad demo
      console.log("- Eliminando invitaciones...");
      const inviteConditions = [inArray(invitations.creatorId, demoUserIds)];
      if (demoCommId) {
        inviteConditions.push(eq(invitations.communityId, demoCommId));
      }
      await tx.delete(invitations)
        .where(or(...inviteConditions))
        .execute();

      // 9. Eliminar solicitudes de ingreso
      console.log("- Eliminando solicitudes de ingreso...");
      const requestConditions = [inArray(joinRequests.userId, demoUserIds)];
      if (demoCommId) {
        requestConditions.push(eq(joinRequests.communityId, demoCommId));
      }
      await tx.delete(joinRequests)
        .where(or(...requestConditions))
        .execute();

      // 10. Eliminar adjuntos subidos por usuarios demo o asociados a posts demo
      console.log("- Eliminando metadatos de adjuntos...");
      const attachmentConditions = [inArray(attachments.uploaderId, demoUserIds)];
      if (demoPostIds.length > 0) {
        attachmentConditions.push(
          inArray(attachments.targetId, demoPostIds)
        );
      }
      await tx.delete(attachments)
        .where(or(...attachmentConditions))
        .execute();

      // 11. Eliminar comentarios asociados a posts demo o escritos por usuarios demo
      console.log("- Eliminando comentarios...");
      const commentConditions = [inArray(comments.authorId, demoUserIds)];
      if (demoPostIds.length > 0) {
        commentConditions.push(
          inArray(comments.postId, demoPostIds)
        );
      }
      await tx.delete(comments)
        .where(or(...commentConditions))
        .execute();

      // 12. Eliminar posts creados por usuarios demo o en la comunidad demo
      console.log("- Eliminando publicaciones...");
      const postConditions = [inArray(posts.authorId, demoUserIds)];
      if (demoCommId) {
        postConditions.push(eq(posts.communityId, demoCommId));
      }
      await tx.delete(posts)
        .where(or(...postConditions))
        .execute();

      // 13. Eliminar membresías de usuarios demo o en la comunidad demo
      console.log("- Eliminando membresías...");
      const memberConditions = [inArray(communityMembers.userId, demoUserIds)];
      if (demoCommId) {
        memberConditions.push(eq(communityMembers.communityId, demoCommId));
      }
      await tx.delete(communityMembers)
        .where(or(...memberConditions))
        .execute();

      // 14. Eliminar comunidad demo
      if (demoCommId) {
        console.log("- Eliminando comunidad demo...");
        await tx.delete(communities)
          .where(eq(communities.id, demoCommId))
          .execute();
      }

      // 15. Eliminar perfiles de usuarios demo
      console.log("- Eliminando perfiles de usuarios demo...");
      await tx.delete(profiles)
        .where(inArray(profiles.userId, demoUserIds))
        .execute();

      // 16. Eliminar usuarios demo
      console.log("- Eliminando usuarios demo...");
      await tx.delete(users)
        .where(inArray(users.id, demoUserIds))
        .execute();
    });

    console.log("====================================================");
    console.log("¡Datos demo eliminados exitosamente de la base de datos!");
    console.log("====================================================");
    process.exit(0);
  } catch (error) {
    console.error("Error fatal al eliminar datos demo:", error);
    process.exit(1);
  }
}

removeDemoData();
