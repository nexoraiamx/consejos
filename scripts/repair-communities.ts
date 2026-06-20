import "./db-guard";
import { db, poolDb } from "../src/db";
import { communities, communityMembers, joinRequests } from "../src/db/schema";
import { eq, and, ne } from "drizzle-orm";

async function repairCommunities() {
  console.log("====================================================");
  console.log("Iniciando Script de Reparación de Comunidades y Roles...");
  console.log("====================================================");

  try {
    const dbCommunities = await db.query.communities.findMany();
    console.log(`Se encontraron ${dbCommunities.length} comunidades para auditar.`);

    let fixedCount = 0;
    let createdCount = 0;
    let deletedDuplicates = 0;

    for (const community of dbCommunities) {
      const creatorId = community.creatorId;
      if (!creatorId) {
        console.log(`[!] Comunidad "${community.displayName}" (${community.slug}) no tiene creatorId asignado. Saltando...`);
        continue;
      }

      console.log(`\nAuditando comunidad: "${community.displayName}" (slug: ${community.slug})`);

      // 1. Consultar todas las membresías del creador en esta comunidad
      const creatorMemberships = await db.query.communityMembers.findMany({
        where: and(
          eq(communityMembers.communityId, community.id),
          eq(communityMembers.userId, creatorId)
        ),
      });

      if (creatorMemberships.length === 0) {
        // No tiene membresía, crearla como owner/approved
        console.log(`  [+] El creador (${creatorId}) no tiene membresía. Creando membresía 'owner'/'approved'...`);
        await db.insert(communityMembers).values({
          communityId: community.id,
          userId: creatorId,
          role: "owner",
          status: "approved",
        });
        createdCount++;
      } else {
        // Tiene al menos una membresía, validar/actualizar la primera y borrar duplicados
        const primary = creatorMemberships[0];
        
        if (primary.role !== "owner" || primary.status !== "approved") {
          console.log(`  [*] Actualizando membresía existente (rol: ${primary.role}, estado: ${primary.status}) a 'owner'/'approved'...`);
          await db.update(communityMembers)
            .set({
              role: "owner",
              status: "approved",
              updatedAt: new Date()
            })
            .where(eq(communityMembers.id, primary.id));
          fixedCount++;
        } else {
          console.log(`  [✓] Membresía del creador es correcta ('owner'/'approved').`);
        }

        // Eliminar membresías duplicadas si existen
        if (creatorMemberships.length > 1) {
          const idsToDelete = creatorMemberships.slice(1).map((m) => m.id);
          console.log(`  [-] Eliminando ${idsToDelete.length} membresías duplicadas para el creador...`);
          for (const id of idsToDelete) {
            await db.delete(communityMembers).where(eq(communityMembers.id, id));
            deletedDuplicates++;
          }
        }
      }

      // 2. Limpiar solicitudes de ingreso pendientes del creador si existen
      const pendingRequests = await db.query.joinRequests.findMany({
        where: and(
          eq(joinRequests.communityId, community.id),
          eq(joinRequests.userId, creatorId)
        ),
      });

      if (pendingRequests.length > 0) {
        console.log(`  [-] Eliminando ${pendingRequests.length} solicitudes de ingreso redundantes del creador...`);
        for (const req of pendingRequests) {
          await db.delete(joinRequests).where(eq(joinRequests.id, req.id));
        }
      }
    }

    console.log("\n========================= RESUMEN DE REPARACIÓN =========================");
    console.log(`- Membresías creadas (creadores sin membresía): ${createdCount}`);
    console.log(`- Membresías corregidas a owner/approved: ${fixedCount}`);
    console.log(`- Membresías duplicadas eliminadas: ${deletedDuplicates}`);
    console.log("✅ ¡Proceso de reparación finalizado correctamente!");
    console.log("=========================================================================");

    process.exit(0);
  } catch (error) {
    console.error("Error fatal durante la reparación:", error);
    process.exit(1);
  }
}

repairCommunities();
