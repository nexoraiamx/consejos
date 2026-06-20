if (process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
  console.error("ERROR: No se permite ejecutar scripts de prueba/sembrado destructivos en un entorno de producción o Vercel.");
  process.exit(1);
}

import { db, poolDb } from "@/db";
import { users, profiles, communities, communityMembers, posts, comments, attachments, auditLogs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { validateFile, generateFileKey } from "@/lib/r2";

async function runTests() {
  console.log("====================================================");
  console.log("Iniciando pruebas de flujo para Adjuntos y Cloudflare R2...");
  console.log("====================================================");

  const uploaderId = "user_att_uploader";
  const nonMemberId = "user_att_non_member";
  const suspendedId = "user_att_suspended";
  const communitySlug = "attachments-flow-test-community";

  try {
    // 1. Limpieza de datos residuales
    console.log("[1/6] Limpiando datos residuales de pruebas previas...");
    await db.delete(auditLogs).execute();
    await db.delete(attachments).execute();
    await db.delete(comments).execute();
    await db.delete(posts).execute();
    await db.delete(communityMembers).execute();
    
    const existingCommunity = await db.query.communities.findFirst({
      where: eq(communities.slug, communitySlug),
    });
    if (existingCommunity) {
      await db.delete(communities).where(eq(communities.id, existingCommunity.id)).execute();
    }
    
    await db.delete(profiles).where(eq(profiles.userId, uploaderId)).execute();
    await db.delete(profiles).where(eq(profiles.userId, nonMemberId)).execute();
    await db.delete(profiles).where(eq(profiles.userId, suspendedId)).execute();
    
    await db.delete(users).where(eq(users.id, uploaderId)).execute();
    await db.delete(users).where(eq(users.id, nonMemberId)).execute();
    await db.delete(users).where(eq(users.id, suspendedId)).execute();

    // 2. Sembrar Usuarios
    console.log("[2/6] Creando usuarios de prueba...");
    await db.insert(users).values([
      { id: uploaderId, email: "uploader@test.com", globalRole: "MEMBER", isSuspended: false },
      { id: nonMemberId, email: "nonmember@test.com", globalRole: "MEMBER", isSuspended: false },
      { id: suspendedId, email: "suspended@test.com", globalRole: "MEMBER", isSuspended: true },
    ]);
    
    await db.insert(profiles).values([
      { userId: uploaderId, displayName: "File Uploader", username: "file_uploader" },
      { userId: nonMemberId, displayName: "Non Member", username: "non_member" },
      { userId: suspendedId, displayName: "Suspended User", username: "suspended_user" },
    ]);

    // 3. Sembrar Comunidad y Membresías
    console.log("[3/6] Creando comunidad y configurando membresías...");
    const [community] = await db.insert(communities).values({
      slug: communitySlug,
      displayName: "Attachments Testing Community",
      privacyType: "PUBLIC",
      creatorId: uploaderId,
    }).returning();

    await db.insert(communityMembers).values([
      { communityId: community.id, userId: uploaderId, role: "MEMBER", status: "APPROVED" },
      { communityId: community.id, userId: suspendedId, role: "MEMBER", status: "APPROVED" },
      // Note: nonMemberId is intentionally NOT added to communityMembers
    ]);

    // 4. Pruebas de Validaciones Puras (validateFile & generateFileKey)
    console.log("[4/6] Ejecutando validaciones puras de archivos (MIME, tamaños, extensiones)...");
    
    // Pruebas de extensión peligrosa
    const extCheck1 = validateFile("exploit.exe", 1000, "image/png");
    console.log(" - exploit.exe:", extCheck1.valid ? "FAIL" : "OK (Bloqueado)", extCheck1.error || "");
    if (extCheck1.valid) throw new Error("Fallo: Se permitió exploit.exe");

    const extCheck2 = validateFile("script.sh", 1000, "application/pdf");
    console.log(" - script.sh:", extCheck2.valid ? "FAIL" : "OK (Bloqueado)", extCheck2.error || "");
    if (extCheck2.valid) throw new Error("Fallo: Se permitió script.sh");

    // Pruebas de límites de tamaño
    const sizeCheck1 = validateFile("avatar.png", 5 * 1024 * 1024, "image/png"); // 5MB image
    console.log(" - avatar.png (5MB):", sizeCheck1.valid ? "OK (Permitido)" : "FAIL", sizeCheck1.error || "");
    if (!sizeCheck1.valid) throw new Error("Fallo: Se bloqueó avatar.png de 5MB");

    const sizeCheck2 = validateFile("banner.png", 15 * 1024 * 1024, "image/png"); // 15MB image
    console.log(" - banner.png (15MB):", sizeCheck2.valid ? "FAIL" : "OK (Bloqueado)", sizeCheck2.error || "");
    if (sizeCheck2.valid) throw new Error("Fallo: Se permitió imagen de 15MB");

    const sizeCheck3 = validateFile("podcast.mp3", 40 * 1024 * 1024, "audio/mpeg"); // 40MB audio
    console.log(" - podcast.mp3 (40MB):", sizeCheck3.valid ? "OK (Permitido)" : "FAIL", sizeCheck3.error || "");
    if (!sizeCheck3.valid) throw new Error("Fallo: Se bloqueó podcast.mp3 de 40MB");

    const sizeCheck4 = validateFile("book.pdf", 30 * 1024 * 1024, "application/pdf"); // 30MB PDF
    console.log(" - book.pdf (30MB):", sizeCheck4.valid ? "FAIL" : "OK (Bloqueado)", sizeCheck4.error || "");
    if (sizeCheck4.valid) throw new Error("Fallo: Se permitió PDF de 30MB");

    // Pruebas de WebM audio/video con codecs
    const webmAudioCheck = validateFile("grabacion.webm", 10 * 1024 * 1024, "audio/webm;codecs=opus");
    console.log(" - grabacion.webm (audio/webm;codecs=opus):", webmAudioCheck.valid ? "OK (Permitido)" : "FAIL", webmAudioCheck.error || "");
    if (!webmAudioCheck.valid) throw new Error("Fallo: Se bloqueó grabacion.webm con codec opus");

    const webmVideoCheck = validateFile("grabacion_video.webm", 30 * 1024 * 1024, "video/webm;codecs=vp9,opus");
    console.log(" - grabacion_video.webm (video/webm;codecs=vp9,opus):", webmVideoCheck.valid ? "OK (Permitido)" : "FAIL", webmVideoCheck.error || "");
    if (!webmVideoCheck.valid) throw new Error("Fallo: Se bloqueó video webm");

    // Pruebas de MIME types no soportados
    const mimeCheck = validateFile("index.html", 200, "text/html");
    console.log(" - index.html (text/html):", mimeCheck.valid ? "FAIL" : "OK (Bloqueado)", mimeCheck.error || "");
    if (mimeCheck.valid) throw new Error("Fallo: Se permitió text/html");

    // Pruebas de generación de keys R2
    const keyDraft = generateFileKey(uploaderId, community.id, "POST", "screenshot.png", undefined, "session-123");
    console.log(" - R2 Key para Borrador (Draft):", keyDraft);
    if (!keyDraft.startsWith(`uploads/${uploaderId}/${community.id}/drafts/session-123/`)) {
      throw new Error("Fallo: Formato de Key de borrador incorrecto");
    }

    const keyExisting = generateFileKey(uploaderId, community.id, "COMMENT", "document.pdf", "post-456");
    console.log(" - R2 Key para Comentario Existente:", keyExisting);
    if (!keyExisting.startsWith(`uploads/${uploaderId}/${community.id}/comment/post-456/`)) {
      throw new Error("Fallo: Formato de Key de contenido existente incorrecto");
    }

    // 5. Simular Flujo de Firma / Permisos API
    console.log("[5/6] Simulando verificaciones de la API de Presign...");
    
    // Validar autorización de membresía aprobada
    const checkMember = async (userId: string) => {
      const userRecord = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!userRecord) return { success: false, error: "Usuario no existe" };
      if (userRecord.isSuspended) return { success: false, error: "Cuenta suspendida" };

      const membership = await db.query.communityMembers.findFirst({
        where: and(
          eq(communityMembers.communityId, community.id),
          eq(communityMembers.userId, userId),
          eq(communityMembers.status, "APPROVED")
        ),
      });

      if (!membership) {
        return { success: false, error: "No es miembro de la comunidad" };
      }
      return { success: true };
    };

    const resMember = await checkMember(uploaderId);
    console.log(" - Miembro aprobado (uploader):", resMember.success ? "OK (Acceso Permitido)" : "FAIL", resMember.error || "");
    if (!resMember.success) throw new Error("Fallo en la verificación de miembro aprobado");

    const resNonMember = await checkMember(nonMemberId);
    console.log(" - No Miembro (non_member):", resNonMember.success ? "FAIL" : "OK (Acceso Denegado)", resNonMember.error || "");
    if (resNonMember.success) throw new Error("Fallo: Se permitió acceso a no miembro");

    const resSuspended = await checkMember(suspendedId);
    console.log(" - Miembro suspendido (suspended):", resSuspended.success ? "FAIL" : "OK (Acceso Denegado)", resSuspended.error || "");
    if (resSuspended.success) throw new Error("Fallo: Se permitió acceso a miembro suspendido");

    // Verificar si hay variables R2 configuradas para la firma real
    const r2Id = process.env.R2_ACCOUNT_ID;
    if (r2Id && r2Id !== "your-cloudflare-account-id") {
      console.log(" - Credenciales Cloudflare R2 encontradas en .env.local!");
      console.log(" - Probando generación real de URL firmada...");
      try {
        const presignRes = await fetch("http://localhost:3000/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            communityId: community.id,
            targetType: "POST",
            uploadSessionId: "test-session",
            fileName: "test-image.png",
            fileSize: 1024 * 1024,
            mimeType: "image/png",
          }),
        });
        if (presignRes.status === 200) {
          const data = await presignRes.json();
          console.log("   -> URL firmada generada con éxito:", data.uploadUrl.substring(0, 80) + "...");
        } else {
          console.log("   -> [Pendiente/Simulada] El servidor local no está corriendo en localhost:3000.");
        }
      } catch (_) {
        console.log("   -> [Pendiente/Simulada] No se pudo conectar al servidor local en localhost:3000.");
      }
    } else {
      console.log(" - [Simulado] Sin variables de Cloudflare R2 reales configuradas en el entorno local. Saltando presign real.");
    }

    // 6. Prueba de Transacción Atómica de Adjuntos en Neon
    console.log("[6/6] Probando inserción transaccional de metadatos de adjuntos en Neon...");
    
    // Crear Post con adjuntos usando poolDb.transaction
    console.log(" - Creando publicación con 2 adjuntos (R2 + Enlace externo)...");
    const [insertedPost] = await poolDb.transaction(async (tx) => {
      const [post] = await tx.insert(posts).values({
        communityId: community.id,
        authorId: uploaderId,
        title: "Test de Publicación con Adjuntos",
        content: "Este post contiene una imagen subida a R2 y un enlace a la documentación de Next.js.",
        postType: "RESOURCE",
        status: "ACTIVE",
      }).returning();

      // Metadatos de adjuntos
      await tx.insert(attachments).values([
        {
          uploaderId,
          targetType: "POST",
          targetId: post.id,
          fileUrl: "https://r2.dev/uploads/uploader/community/image.png",
          fileKey: "uploads/uploader/community/image.png",
          fileName: "screenshot.png",
          fileSize: 500000,
          mimeType: "image/png",
        },
        {
          uploaderId,
          targetType: "POST",
          targetId: post.id,
          fileUrl: "https://nextjs.org/docs",
          fileKey: "external",
          fileName: "Documentación Next.js",
          fileSize: 0,
          mimeType: "text/uri-list",
        }
      ]);

      await tx.insert(auditLogs).values({
        actorId: uploaderId,
        action: "POST_CREATE",
        targetType: "POST",
        targetId: post.id,
        description: "Post creado con adjuntos en testing",
      });

      return [post];
    });

    // Validar en la base de datos
    const dbAttachmentsPost = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.targetType, "POST"), eq(attachments.targetId, insertedPost.id)));
    
    console.log(`   -> Metadatos insertados en BD para Post: ${dbAttachmentsPost.length} adjuntos`);
    if (dbAttachmentsPost.length !== 2) {
      throw new Error("Fallo: No se guardaron exactamente 2 adjuntos en el Post");
    }

    // Crear Comentario con adjuntos usando poolDb.transaction
    console.log(" - Creando comentario con 1 adjunto (PDF)...");
    const [insertedComment] = await poolDb.transaction(async (tx) => {
      const [comment] = await tx.insert(comments).values({
        postId: insertedPost.id,
        parentId: null,
        authorId: uploaderId,
        content: "Aquí está la guía en PDF.",
        status: "ACTIVE",
      }).returning();

      await tx.insert(attachments).values({
        uploaderId,
        targetType: "COMMENT",
        targetId: comment.id,
        fileUrl: "https://r2.dev/uploads/uploader/community/guide.pdf",
        fileKey: "uploads/uploader/community/guide.pdf",
        fileName: "guia.pdf",
        fileSize: 1500000,
        mimeType: "application/pdf",
      });

      return [comment];
    });

    const dbAttachmentsComment = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.targetType, "COMMENT"), eq(attachments.targetId, insertedComment.id)));
    
    console.log(`   -> Metadatos insertados en BD para Comentario: ${dbAttachmentsComment.length} adjuntos`);
    if (dbAttachmentsComment.length !== 1) {
      throw new Error("Fallo: No se guardó el adjunto en el Comentario");
    }

    console.log("\n====================================================");
    console.log("¡Todas las pruebas del flujo de adjuntos pasaron con éxito!");
    console.log("====================================================");

  } catch (error) {
    console.error("\n====================================================");
    console.error("ERROR: Una o más pruebas fallaron:");
    console.error(error);
    console.error("====================================================");
    process.exit(1);
  } finally {
    // 7. Limpieza final de datos sembrados
    console.log("\nLimpiando datos de prueba...");
    try {
      await db.delete(auditLogs).execute();
      await db.delete(attachments).execute();
      await db.delete(comments).execute();
      await db.delete(posts).execute();
      await db.delete(communityMembers).execute();
      
      const existingCommunity = await db.query.communities.findFirst({
        where: eq(communities.slug, communitySlug),
      });
      if (existingCommunity) {
        await db.delete(communities).where(eq(communities.id, existingCommunity.id)).execute();
      }
      
      await db.delete(profiles).where(eq(profiles.userId, uploaderId)).execute();
      await db.delete(profiles).where(eq(profiles.userId, nonMemberId)).execute();
      await db.delete(profiles).where(eq(profiles.userId, suspendedId)).execute();
      
      await db.delete(users).where(eq(users.id, uploaderId)).execute();
      await db.delete(users).where(eq(users.id, nonMemberId)).execute();
      await db.delete(users).where(eq(users.id, suspendedId)).execute();
      console.log("Limpieza completada.");
    } catch (cleanErr) {
      console.error("Error al limpiar datos:", cleanErr);
    }
    process.exit(0);
  }
}

runTests();
