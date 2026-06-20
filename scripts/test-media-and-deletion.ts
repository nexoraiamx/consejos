import "./db-guard";
import Module from "module";

let activeUserId = "user_creator";
const capturedDeletedKeys: string[] = [];

// Sobrescribir require al inicio del archivo para interceptar Clerk, server-only y next/cache
const originalRequire = Module.prototype.require;
// @ts-ignore
Module.prototype.require = function (id: string) {
  if (id === "server-only") {
    return {};
  }
  
  if (id === "next/cache") {
    return {
      revalidatePath: () => {}
    };
  }
  
  if (id.includes("@clerk/nextjs") || id.includes("clerk")) {
    return {
      auth: async () => ({ userId: activeUserId }),
      currentUser: async () => ({
        id: activeUserId,
        emailAddresses: [{ id: "email1", emailAddress: `${activeUserId}@test.com` }],
        primaryEmailAddressId: "email1",
        username: `${activeUserId}_uname`
      })
    };
  }

  if (id === "@aws-sdk/client-s3") {
    const originalS3 = originalRequire.apply(this, [id]);
    return {
      ...originalS3,
      S3Client: class {
        send = async (command: any) => {
          if (command.constructor.name === "DeleteObjectsCommand") {
            const objects = command.input?.Delete?.Objects || [];
            capturedDeletedKeys.push(...objects.map((o: any) => o.Key));
            console.log("[MOCK S3] Deleted objects:", objects);
          }
          return { Deleted: [] };
        };
      }
    };
  }
  
  // @ts-ignore
  return originalRequire.apply(this, [id]);
};

async function runTests() {
  console.log("Iniciando pruebas de publicaciones media-only y eliminación de comunidades...");

  // Importar Drizzle y dependencias dinámicamente para que usen el require interceptado
  const { db } = require("../src/db");
  const { 
    users,
    profiles, 
    communities, 
    communityMembers, 
    posts, 
    comments, 
    attachments, 
    userReputation,
    auditLogs
  } = require("../src/db/schema");
  const { eq, and, isNull } = require("drizzle-orm");

  const { createPostAction, updatePostAction } = require("../src/app/actions/posts");
  const { createCommentAction, updateCommentAction } = require("../src/app/actions/comments");
  const { deleteCommunityAction } = require("../src/app/actions/communities");

  const creatorId = "user_creator";
  const adminId = "user_admin";
  const memberId = "user_member";
  const moderatorId = "user_moderator";
  const strangerId = "user_stranger";
  const globalAdminId = "user_global_admin";

  const slugTest = "comm-test-media-deletion";

  try {
    // 1. Limpieza de datos previos
    console.log("Limpiando datos de prueba previos...");
    await db.delete(attachments).where(eq(attachments.uploaderId, creatorId)).execute();
    await db.delete(attachments).where(eq(attachments.uploaderId, memberId)).execute();

    const oldComm = await db.query.communities.findFirst({
      where: eq(communities.slug, slugTest),
    });

    if (oldComm) {
      await db.delete(comments).where(eq(comments.postId, oldComm.id)).execute();
      await db.delete(posts).where(eq(posts.communityId, oldComm.id)).execute();
      await db.delete(communityMembers).where(eq(communityMembers.communityId, oldComm.id)).execute();
      await db.delete(communities).where(eq(communities.id, oldComm.id)).execute();
    }

    const testUsers = [creatorId, adminId, memberId, moderatorId, strangerId, globalAdminId];
    for (const uId of testUsers) {
      await db.delete(userReputation).where(eq(userReputation.userId, uId)).execute();
      await db.delete(profiles).where(eq(profiles.userId, uId)).execute();
      await db.delete(users).where(eq(users.id, uId)).execute();
    }

    // 2. Sembrar usuarios y roles
    console.log("Sembrando usuarios...");
    for (const uId of testUsers) {
      const gRole = uId === globalAdminId ? "GLOBAL_ADMIN" : "MEMBER";
      await db.insert(users).values({ id: uId, email: `${uId}@test.com`, globalRole: gRole });
      await db.insert(profiles).values({ userId: uId, displayName: `DisplayName ${uId}`, username: `${uId}_username` });
      await db.insert(userReputation).values({ userId: uId, score: 50, level: 1 });
    }

    // 3. Crear comunidad de prueba
    console.log("Creando comunidad de prueba...");
    activeUserId = creatorId;
    const [community] = await db.insert(communities).values({
      slug: slugTest,
      displayName: "Comunidad de Medios y Borrado",
      description: "Pruebas de adjuntos y soft delete",
      privacyType: "PUBLIC",
      creatorId: creatorId,
      avatarUrl: "https://r2.consejos.dev/uploads/user_creator/communities/comm-test-media-deletion/avatar.png",
      bannerUrl: "https://r2.consejos.dev/uploads/user_creator/communities/comm-test-media-deletion/banner.png",
    }).returning();

    // Sembrar membresías
    await db.insert(communityMembers).values([
      { communityId: community.id, userId: creatorId, role: "COMMUNITY_ADMIN", status: "APPROVED" },
      { communityId: community.id, userId: adminId, role: "COMMUNITY_ADMIN", status: "APPROVED" },
      { communityId: community.id, userId: moderatorId, role: "MODERATOR", status: "APPROVED" },
      { communityId: community.id, userId: memberId, role: "MEMBER", status: "APPROVED" },
    ]);

    // ==========================================
    // SECCIÓN 1: PRUEBAS DE PUBLICACIONES MEDIA-ONLY
    // ==========================================
    console.log("\n--- Prueba A: Crear post con título y attachments (sin contenido) ---");
    activeUserId = memberId;
    const postRes1 = await createPostAction({
      communityId: community.id,
      title: "Publicación sólo con adjuntos",
      content: "",
      postType: "DISCUSSION",
      attachments: [
        {
          fileUrl: "https://r2.consejos.dev/audio1.mp3",
          fileKey: "uploads/user_member/comm-test-media-deletion/posts/audio1.mp3",
          fileName: "audio1.mp3",
          fileSize: 1024,
          mimeType: "audio/mpeg"
        },
        {
          fileUrl: "https://google.com",
          fileKey: "external",
          fileName: "Link Externo",
          fileSize: 0,
          mimeType: "text/plain"
        }
      ]
    });

    if (!postRes1.success) {
      throw new Error(`FALLO: No se permitió crear post con solo archivos. Error: ${postRes1.error}`);
    }
    console.log("ÉXITO: Se creó el post solo-media con ID:", postRes1.postId);

    console.log("\n--- Prueba B: Crear post sin contenido ni attachments (debe fallar) ---");
    const postRes2 = await createPostAction({
      communityId: community.id,
      title: "Publicación vacía",
      content: "",
      postType: "DISCUSSION",
      attachments: []
    });

    if (postRes2.success) {
      throw new Error("FALLO: Se permitió crear un post completamente vacío.");
    }
    console.log("ÉXITO: Se bloqueó la creación del post vacío con error:", postRes2.error);

    console.log("\n--- Prueba C: Editar post para dejarlo sin contenido en post que tiene attachments ---");
    activeUserId = memberId;
    const editRes1 = await updatePostAction(postRes1.postId!, {
      title: "Publicación sólo con adjuntos (editada)",
      content: "",
      postType: "DISCUSSION"
    });

    if (!editRes1.success) {
      throw new Error(`FALLO: No se permitió editar a contenido vacío a pesar de tener adjuntos. Error: ${editRes1.error}`);
    }
    console.log("ÉXITO: Se permitió limpiar el texto del post que posee adjuntos.");

    console.log("\n--- Prueba D: Editar post para dejarlo sin contenido en post que NO tiene attachments (debe fallar) ---");
    // Crear un post con texto común primero
    const postRes3 = await createPostAction({
      communityId: community.id,
      title: "Post de texto puro",
      content: "Este post tiene texto pero no adjuntos.",
      postType: "DISCUSSION"
    });

    // Intentar vaciar el texto
    const editRes2 = await updatePostAction(postRes3.postId!, {
      title: "Post de texto puro (editado)",
      content: "",
      postType: "DISCUSSION"
    });

    if (editRes2.success) {
      throw new Error("FALLO: Se permitió dejar sin contenido un post que no tiene adjuntos.");
    }
    console.log("ÉXITO: Se bloqueó la edición vacía en post sin adjuntos con error:", editRes2.error);

    // ==========================================
    // SECCIÓN 2: PRUEBAS DE COMENTARIOS MEDIA-ONLY
    // ==========================================
    console.log("\n--- Prueba E: Crear comentario con attachments (sin texto) ---");
    activeUserId = memberId;
    const commentRes1 = await createCommentAction({
      postId: postRes1.postId!,
      content: "",
      attachments: [
        {
          fileUrl: "https://r2.consejos.dev/pdf1.pdf",
          fileKey: "uploads/user_member/comm-test-media-deletion/comments/pdf1.pdf",
          fileName: "pdf1.pdf",
          fileSize: 2048,
          mimeType: "application/pdf"
        }
      ]
    });

    if (!commentRes1.success) {
      throw new Error(`FALLO: No se permitió crear comentario con solo archivos. Error: ${commentRes1.error}`);
    }
    console.log("ÉXITO: Se creó el comentario solo-media con ID:", commentRes1.commentId);

    console.log("\n--- Prueba F: Crear comentario sin contenido ni attachments (debe fallar) ---");
    const commentRes2 = await createCommentAction({
      postId: postRes1.postId!,
      content: "",
      attachments: []
    });

    if (commentRes2.success) {
      throw new Error("FALLO: Se permitió crear un comentario vacío.");
    }
    console.log("ÉXITO: Se bloqueó el comentario vacío con error:", commentRes2.error);

    console.log("\n--- Prueba G: Editar comentario para dejarlo vacío en comentario con attachments ---");
    activeUserId = memberId;
    const commentEditRes1 = await updateCommentAction(commentRes1.commentId!, "");
    if (!commentEditRes1.success) {
      throw new Error(`FALLO: No se permitió editar el comentario a texto vacío a pesar de tener adjuntos. Error: ${commentEditRes1.error}`);
    }
    console.log("ÉXITO: Se editó a vacío el comentario que posee adjuntos.");

    // ==========================================
    // SECCIÓN 3: PRUEBAS DE ELIMINACIÓN (SOFT DELETE) DE COMUNIDADES
    // ==========================================
    console.log("\n--- Prueba H: Miembro común intenta borrar comunidad (debe fallar) ---");
    activeUserId = memberId;
    const delRes1 = await deleteCommunityAction(community.id);
    if (delRes1.success) {
      throw new Error("FALLO: Se permitió a un miembro común eliminar la comunidad.");
    }
    console.log("ÉXITO: Se bloqueó la eliminación al miembro común con error:", delRes1.error);

    console.log("\n--- Prueba I: Moderador intenta borrar comunidad (debe fallar) ---");
    activeUserId = moderatorId;
    const delRes2 = await deleteCommunityAction(community.id);
    if (delRes2.success) {
      throw new Error("FALLO: Se permitió a un moderador eliminar la comunidad.");
    }
    console.log("ÉXITO: Se bloqueó la eliminación al moderador con error:", delRes2.error);

    console.log("\n--- Prueba J: Creador borra la comunidad (debe pasar) ---");
    activeUserId = creatorId;
    const delRes3 = await deleteCommunityAction(community.id);
    if (!delRes3.success) {
      throw new Error(`FALLO: El creador no pudo eliminar la comunidad. Error: ${delRes3.error}`);
    }
    console.log("ÉXITO: El creador eliminó la comunidad exitosamente.");

    // Verificar en DB el soft delete
    const dbCommDeleted = await db.query.communities.findFirst({
      where: eq(communities.id, community.id)
    });
    if (!dbCommDeleted || !dbCommDeleted.deletedAt) {
      throw new Error("FALLO: La comunidad no tiene establecido deletedAt en base de datos.");
    }
    console.log("ÉXITO: La comunidad fue marcada físicamente con deletedAt:", dbCommDeleted.deletedAt);

    // Verificar que R2 intentó eliminar los archivos correctos
    console.log("Verificando que se enviaron las claves correctas a R2 y se omitieron los links externos...");
    const expectedKeys = [
      "uploads/user_creator/communities/comm-test-media-deletion/avatar.png",
      "uploads/user_creator/communities/comm-test-media-deletion/banner.png",
      "uploads/user_member/comm-test-media-deletion/posts/audio1.mp3",
      "uploads/user_member/comm-test-media-deletion/comments/pdf1.pdf"
    ];

    for (const key of expectedKeys) {
      if (!capturedDeletedKeys.includes(key)) {
        throw new Error(`FALLO: No se intentó eliminar la clave esperada en R2: ${key}`);
      }
    }

    if (capturedDeletedKeys.includes("external")) {
      throw new Error("FALLO: Se intentó eliminar la clave 'external' (enlace externo).");
    }
    console.log("ÉXITO: Se enviaron las claves correctas a R2 y se omitió 'external'.");

    // Verificar audit logs
    const r2AuditLog = await db.query.auditLogs.findFirst({
      where: and(
        eq(auditLogs.targetId, community.id),
        eq(auditLogs.action, "COMMUNITY_R2_CLEANUP_SUCCESS")
      )
    });
    if (!r2AuditLog) {
      throw new Error("FALLO: No se registró el audit log COMMUNITY_R2_CLEANUP_SUCCESS.");
    }
    console.log("ÉXITO: Se registró el audit log de limpieza de R2:", r2AuditLog.description);

    // Verificar que los posts de la comunidad eliminada no aparecen en el feed activo (usando la misma query del feed)
    console.log("\n--- Prueba M: Verificar que posts de la comunidad eliminada no aparecen en el feed ---");
    const feedPosts = await db
      .select({
        id: posts.id,
        communityId: posts.communityId,
      })
      .from(posts)
      .innerJoin(communities, eq(posts.communityId, communities.id))
      .where(
        and(
          isNull(posts.deletedAt),
          isNull(communities.deletedAt),
          eq(posts.status, "ACTIVE")
        )
      );

    const hasDeletedCommPosts = feedPosts.some((p: any) => p.communityId === community.id);
    if (hasDeletedCommPosts) {
      throw new Error("FALLO: El feed activo contiene publicaciones de una comunidad eliminada.");
    }
    console.log("ÉXITO: Las publicaciones de la comunidad eliminada no se muestran en el feed.");

    // ==========================================
    // SECCIÓN 4: PRUEBAS DE ELIMINACIÓN POR GLOBAL ADMIN / COMMUNITY ADMIN (RE-CREACIÓN Y NUEVAS PRUEBAS)
    // ==========================================
    console.log("\n--- Prueba K: COMMUNITY_ADMIN borra la comunidad (debe pasar) ---");
    // Volvemos a activar la comunidad quitando el deletedAt
    await db.update(communities).set({ deletedAt: null }).where(eq(communities.id, community.id));
    
    // Ejecutamos eliminación como admin
    activeUserId = adminId;
    const delRes4 = await deleteCommunityAction(community.id);
    if (!delRes4.success) {
      throw new Error(`FALLO: El COMMUNITY_ADMIN no pudo eliminar la comunidad. Error: ${delRes4.error}`);
    }
    console.log("ÉXITO: El COMMUNITY_ADMIN eliminó la comunidad exitosamente.");

    console.log("\n--- Prueba L: GLOBAL_ADMIN borra la comunidad (debe pasar) ---");
    // Volvemos a activar
    await db.update(communities).set({ deletedAt: null }).where(eq(communities.id, community.id));

    // Ejecutamos como global admin
    activeUserId = globalAdminId;
    const delRes5 = await deleteCommunityAction(community.id);
    if (!delRes5.success) {
      throw new Error(`FALLO: El GLOBAL_ADMIN no pudo eliminar la comunidad. Error: ${delRes5.error}`);
    }
    console.log("ÉXITO: El GLOBAL_ADMIN eliminó la comunidad exitosamente.");

    // 4. Limpieza final de datos de prueba
    console.log("\nLimpiando datos sembrados...");
    await db.delete(attachments).where(eq(attachments.uploaderId, creatorId)).execute();
    await db.delete(attachments).where(eq(attachments.uploaderId, memberId)).execute();
    await db.delete(comments).where(eq(comments.postId, postRes1.postId!)).execute();
    await db.delete(posts).where(eq(posts.communityId, community.id)).execute();
    await db.delete(communityMembers).where(eq(communityMembers.communityId, community.id)).execute();
    await db.delete(communities).where(eq(communities.id, community.id)).execute();

    for (const uId of testUsers) {
      await db.delete(userReputation).where(eq(userReputation.userId, uId)).execute();
      await db.delete(profiles).where(eq(profiles.userId, uId)).execute();
      await db.delete(users).where(eq(users.id, uId)).execute();
    }

    console.log("\n¡Todas las pruebas pasaron satisfactoriamente!");
    process.exit(0);
  } catch (error) {
    console.error("\nPrueba fallida con error:", error);
    process.exit(1);
  }
}

runTests();
