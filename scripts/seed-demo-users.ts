import { db, poolDb } from "@/db";
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
  auditLogs 
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function runSeed() {
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    console.error("ERROR: No se permite ejecutar scripts de prueba/sembrado destructivos en un entorno de producción o Vercel.");
    process.exit(1);
  }

  console.log("====================================================");
  console.log("Iniciando sembrado de datos demo para Producción...");
  console.log("====================================================");

  try {
    await poolDb.transaction(async (tx) => {
      // 1. Sembrar/Actualizar usuarios demo
      console.log("1. Configurando usuarios demo (Global Admin, Community Admin, Member)...");
      
      // Global Admin
      let adminRecord = await tx.query.users.findFirst({ where: eq(users.email, "admin@nexorai.mx") });
      if (!adminRecord) {
        [adminRecord] = await tx.insert(users).values({
          id: "demo_admin_clerk_id",
          email: "admin@nexorai.mx",
          globalRole: "GLOBAL_ADMIN",
        }).returning();
        await tx.insert(profiles).values({
          userId: adminRecord.id,
          displayName: "Admin Global",
          username: "admin_global",
          bio: "Administrador general de la plataforma Consejos.",
        });
        await tx.insert(userReputation).values({
          userId: adminRecord.id,
          score: 100,
          level: 2,
        });
        console.log("   -> Creado usuario demo de Admin Global.");
      } else {
        await tx.update(users).set({ globalRole: "GLOBAL_ADMIN" }).where(eq(users.id, adminRecord.id));
        console.log("   -> Actualizado usuario existente a Admin Global.");
      }

      // Community Admin
      let cadminRecord = await tx.query.users.findFirst({ where: eq(users.email, "cadmin@nexorai.mx") });
      if (!cadminRecord) {
        [cadminRecord] = await tx.insert(users).values({
          id: "demo_cadmin_clerk_id",
          email: "cadmin@nexorai.mx",
          globalRole: "MEMBER",
        }).returning();
        await tx.insert(profiles).values({
          userId: cadminRecord.id,
          displayName: "Comunidad Administrador",
          username: "comunidad_admin",
          bio: "Administrador de comunidades locales y moderador experto.",
        });
        await tx.insert(userReputation).values({
          userId: cadminRecord.id,
          score: 250,
          level: 3,
        });
        console.log("   -> Creado usuario demo de Community Admin.");
      } else {
        console.log("   -> Usuario Community Admin ya existe.");
      }

      // Normal Member / Comentarista
      let memberRecord = await tx.query.users.findFirst({ where: eq(users.email, "member@nexorai.mx") });
      if (!memberRecord) {
        [memberRecord] = await tx.insert(users).values({
          id: "demo_member_clerk_id",
          email: "member@nexorai.mx",
          globalRole: "MEMBER",
        }).returning();
        await tx.insert(profiles).values({
          userId: memberRecord.id,
          displayName: "Juan Perez",
          username: "juan_perez",
          bio: "Desarrollador Full Stack interesado en optimización de bases de datos y PWAs.",
        });
        await tx.insert(userReputation).values({
          userId: memberRecord.id,
          score: 80,
          level: 1,
        });
        console.log("   -> Creado usuario demo de Member/Comentarista.");
      } else {
        console.log("   -> Usuario Member ya existe.");
      }

      // 2. Sembrar Comunidad Demo
      console.log("\n2. Configurando comunidad demo...");
      let community = await tx.query.communities.findFirst({ where: eq(communities.slug, "comunidad-demo") });
      if (!community) {
        [community] = await tx.insert(communities).values({
          slug: "comunidad-demo",
          displayName: "Comunidad Demo",
          description: "Espacio público para pruebas de QA, retroalimentación y demostraciones generales.",
          privacyType: "PUBLIC",
          creatorId: cadminRecord.id,
        }).returning();
        console.log("   -> Creada comunidad 'r/comunidad-demo'.");
      } else {
        console.log("   -> Comunidad 'r/comunidad-demo' ya existe.");
      }

      // Configurar membresías locales
      console.log("3. Configurando membresías en comunidad demo...");
      const checkMembership = async (userId: string) => {
        return tx.query.communityMembers.findFirst({
          where: and(
            eq(communityMembers.communityId, community!.id),
            eq(communityMembers.userId, userId)
          )
        });
      };

      const member1 = await checkMembership(cadminRecord.id);
      if (!member1) {
        await tx.insert(communityMembers).values({
          communityId: community.id,
          userId: cadminRecord.id,
          role: "COMMUNITY_ADMIN",
          status: "APPROVED",
        });
      }

      const member2 = await checkMembership(memberRecord.id);
      if (!member2) {
        await tx.insert(communityMembers).values({
          communityId: community.id,
          userId: memberRecord.id,
          role: "MEMBER",
          status: "APPROVED",
        });
      }

      // 4. Sembrar Posts Demo
      console.log("\n4. Configurando publicaciones demo...");
      
      // Question Post
      let questionPost = await tx.query.posts.findFirst({
        where: and(
          eq(posts.communityId, community.id),
          eq(posts.title, "¿Cómo implementar persistencia local sin conexión en una PWA?")
        )
      });
      if (!questionPost) {
        [questionPost] = await tx.insert(posts).values({
          communityId: community.id,
          authorId: memberRecord.id,
          title: "¿Cómo implementar persistencia local sin conexión en una PWA?",
          content: "Hola, estoy construyendo una Progressive Web App y me gustaría saber cuál es la mejor estrategia para almacenar datos offline de forma consistente y sincronizar cuando vuelva la conexión. ¿Es mejor IndexedDB o localStorage?",
          postType: "QUESTION",
          status: "ACTIVE",
        }).returning();
        console.log("   -> Creado post de tipo QUESTION.");
      }

      // Resource Post
      let resourcePost = await tx.query.posts.findFirst({
        where: and(
          eq(posts.communityId, community.id),
          eq(posts.title, "Guía oficial de integración con Cloudflare R2")
        )
      });
      if (!resourcePost) {
        [resourcePost] = await tx.insert(posts).values({
          communityId: community.id,
          authorId: cadminRecord.id,
          title: "Guía oficial de integración con Cloudflare R2",
          content: "Comparto la documentación y el helper básico para firmar subidas directas desde el navegador a Cloudflare R2 usando el SDK de AWS S3 en Next.js 15+.",
          postType: "RESOURCE",
          status: "ACTIVE",
        }).returning();

        // Guardar adjuntos para el post de recursos
        await tx.insert(attachments).values([
          {
            uploaderId: cadminRecord.id,
            targetType: "POST",
            targetId: resourcePost.id,
            fileUrl: "https://pub-demo.r2.dev/uploads/guide.pdf",
            fileKey: "uploads/demo/guide.pdf",
            fileName: "r2_integration_guide.pdf",
            fileSize: 1250000,
            mimeType: "application/pdf",
          },
          {
            uploaderId: cadminRecord.id,
            targetType: "POST",
            targetId: resourcePost.id,
            fileUrl: "https://cloudflare.com/r2",
            fileKey: "external",
            fileName: "Documentación R2",
            fileSize: 0,
            mimeType: "text/uri-list",
          }
        ]);
        console.log("   -> Creado post de tipo RESOURCE con adjuntos.");
      }

      // 5. Sembrar Comentarios y Respuesta Aceptada
      console.log("\n5. Configurando comentarios y respuesta aceptada...");
      
      let comment1 = await tx.query.comments.findFirst({
        where: and(eq(comments.postId, questionPost.id), eq(comments.authorId, cadminRecord.id))
      });
      if (!comment1) {
        [comment1] = await tx.insert(comments).values({
          postId: questionPost.id,
          parentId: null,
          authorId: cadminRecord.id,
          content: "Para aplicaciones robustas, definitivamente debes usar IndexedDB. LocalStorage tiene un límite de 5MB y es síncrono, lo que puede bloquear el hilo principal de renderizado.",
          status: "ACTIVE",
        }).returning();

        const [comment2] = await tx.insert(comments).values({
          postId: questionPost.id,
          parentId: comment1.id,
          authorId: memberRecord.id,
          content: "¡Excelente consejo! Acabo de probar con IndexedDB y el rendimiento offline es formidable. Gracias.",
          status: "ACTIVE",
        }).returning();

        // Marcar comment1 como respuesta aceptada en el post
        await tx.update(posts).set({
          acceptedAnswerId: comment1.id,
        }).where(eq(posts.id, questionPost.id));

        // Registrar evento de reputación
        await tx.insert(reputationEvents).values({
          userId: cadminRecord.id,
          eventType: "ANSWER_ACCEPTED",
          points: 50,
          sourceType: "COMMENT",
          sourceId: comment1.id,
        });

        console.log("   -> Comentarios creados y respuesta del Community Admin aceptada (+50 Reputación).");
      }

      // 6. Sembrar Notificación Demo
      console.log("\n6. Configurando notificaciones demo...");
      const existingNotif = await tx.query.notifications.findFirst({
        where: eq(notifications.recipientId, cadminRecord.id)
      });
      if (!existingNotif && comment1) {
        await tx.insert(notifications).values({
          recipientId: cadminRecord.id,
          senderId: memberRecord.id,
          type: "COMMENT",
          targetType: "COMMENT",
          targetId: comment1.id,
          isRead: false,
        });
        console.log("   -> Notificación de respuesta creada para el Community Admin.");
      }

      // 7. Sembrar Reporte Demo Pendiente
      console.log("\n7. Configurando reportes demo...");
      const existingReport = await tx.query.reports.findFirst({
        where: eq(reports.targetId, questionPost.id)
      });
      if (!existingReport) {
        await tx.insert(reports).values({
          reporterId: memberRecord.id,
          targetType: "POST",
          targetId: questionPost.id,
          reason: "OFF_TOPIC",
          description: "Creo que este post encaja mejor en una comunidad de desarrollo móvil.",
          status: "PENDING",
        });
        console.log("   -> Reporte pendiente creado para el post QUESTION.");
      }

      // 8. Log de Auditoría general
      await tx.insert(auditLogs).values({
        actorId: adminRecord.id,
        action: "SYSTEM_SEED",
        targetType: "COMMUNITY",
        targetId: community.id,
        description: "Sembrado inicial completo de datos de producción y usuarios demo finalizado.",
      });

    });

    console.log("\n====================================================");
    console.log("¡Sembrado de datos demo completado exitosamente!");
    console.log("====================================================");
    process.exit(0);
  } catch (error) {
    console.error("Error al ejecutar el sembrado de producción:", error);
    process.exit(1);
  }
}

runSeed();
