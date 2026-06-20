import { db } from "@/db";
import { attachments, posts, comments } from "@/db/schema";
import { inArray } from "drizzle-orm";

async function detectOrphans() {
  console.log("====================================================");
  console.log("Iniciando auditoría de archivos adjuntos huérfanos...");
  console.log("====================================================");

  try {
    // 1. Obtener todos los adjuntos
    console.log("Consultando todos los adjuntos de la base de datos...");
    const allAttachments = await db.select().from(attachments);
    console.log(`Se encontraron ${allAttachments.length} adjuntos en total.`);

    if (allAttachments.length === 0) {
      console.log("No hay adjuntos para auditar.");
      return;
    }

    // 2. Obtener IDs de posts y comentarios existentes para mapeo rápido
    const postIds = allAttachments
      .filter((att) => att.targetType === "POST" && att.targetId)
      .map((att) => att.targetId as string);

    const commentIds = allAttachments
      .filter((att) => att.targetType === "COMMENT" && att.targetId)
      .map((att) => att.targetId as string);

    // Consultar posts reales en DB
    const existingPosts = postIds.length > 0
      ? await db.select({ id: posts.id }).from(posts).where(inArray(posts.id, postIds))
      : [];
    const existingPostIdsSet = new Set(existingPosts.map((p) => p.id));

    // Consultar comentarios reales en DB
    const existingComments = commentIds.length > 0
      ? await db.select({ id: comments.id }).from(comments).where(inArray(comments.id, commentIds))
      : [];
    const existingCommentIdsSet = new Set(existingComments.map((c) => c.id));

    // 3. Filtrar huérfanos
    const orphans: typeof allAttachments = [];

    for (const att of allAttachments) {
      if (att.targetType === "POST") {
        if (!att.targetId || !existingPostIdsSet.has(att.targetId)) {
          orphans.push(att);
        }
      } else if (att.targetType === "COMMENT") {
        if (!att.targetId || !existingCommentIdsSet.has(att.targetId)) {
          orphans.push(att);
        }
      } else {
        // Otros tipos
        if (!att.targetId) {
          orphans.push(att);
        }
      }
    }

    // 4. Mostrar resultados
    if (orphans.length === 0) {
      console.log("\n✅ ¡ÉXITO! No se encontraron adjuntos huérfanos en Neon DB.");
    } else {
      console.log(`\n❌ Se detectaron ${orphans.length} adjuntos huérfanos:\n`);
      console.log(
        "------------------------------------------------------------------------------------------------"
      );
      console.log(
        String("ID").padEnd(38) +
        " | " +
        String("Tipo").padEnd(8) +
        " | " +
        String("Target ID").padEnd(38) +
        " | " +
        String("Nombre de Archivo")
      );
      console.log(
        "------------------------------------------------------------------------------------------------"
      );
      for (const orphan of orphans) {
        console.log(
          String(orphan.id).padEnd(38) +
          " | " +
          String(orphan.targetType).padEnd(8) +
          " | " +
          String(orphan.targetId || "N/A").padEnd(38) +
          " | " +
          orphan.fileName
        );
      }
      console.log(
        "------------------------------------------------------------------------------------------------"
      );
      console.log("\nSugerencia: Puedes eliminarlos de la base de datos o verificar si existen en Cloudflare R2.");
    }

  } catch (error) {
    console.error("Error durante la detección de huérfanos:", error);
  } finally {
    process.exit(0);
  }
}

detectOrphans();
