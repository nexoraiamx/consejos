import "./db-guard";
import { db, poolDb } from "../src/db";
import { communities, communityMembers } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

async function repairCommunityOwners() {
  console.log("Iniciando script de reparación de membresías de creadores de comunidades...");

  try {
    // 1. Obtener todas las comunidades activas (no eliminadas)
    const allCommunities = await db.query.communities.findMany({
      where: (table, { isNull }) => isNull(table.deletedAt),
    });

    console.log(`Se encontraron ${allCommunities.length} comunidades para procesar.`);

    let repairedCount = 0;

    for (const community of allCommunities) {
      const { id: communityId, displayName, slug, creatorId } = community;

      if (!creatorId) {
        console.log(`[Info] La comunidad "${displayName}" (r/${slug}) no tiene creatorId asociado. Omitiendo.`);
        continue;
      }

      // 2. Buscar si el creador tiene un registro de membresía
      const membership = await db.query.communityMembers.findFirst({
        where: and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, creatorId)
        ),
      });

      if (!membership) {
        // Caso A: No existe membresía. Insertarla.
        console.log(`[Reparando] El creador ${creatorId} no tiene membresía en "${displayName}" (r/${slug}). Creándola...`);
        
        await db.insert(communityMembers).values({
          communityId,
          userId: creatorId,
          role: "COMMUNITY_ADMIN",
          status: "APPROVED",
        });

        console.log(`  -> Membresía creada como COMMUNITY_ADMIN / APPROVED.`);
        repairedCount++;
      } else {
        // Caso B: Existe membresía pero tiene valores inconsistentes (por ejemplo minúsculas o roles legacy)
        const roleUpper = membership.role.toUpperCase();
        const statusUpper = membership.status.toUpperCase();

        const needsRoleRepair = roleUpper !== "COMMUNITY_ADMIN" && roleUpper !== "OWNER";
        const needsStatusRepair = statusUpper !== "APPROVED";
        const needsNormalization = membership.role !== "COMMUNITY_ADMIN" || membership.status !== "APPROVED";

        if (needsRoleRepair || needsStatusRepair || needsNormalization) {
          console.log(`[Reparando] Ajustando membresía de creador en "${displayName}" (r/${slug}).`);
          console.log(`  -> Actual: rol="${membership.role}", estado="${membership.status}"`);
          
          await db.update(communityMembers)
            .set({
              role: "COMMUNITY_ADMIN",
              status: "APPROVED",
              updatedAt: new Date(),
            })
            .where(eq(communityMembers.id, membership.id));

          console.log(`  -> Actualizado a: rol="COMMUNITY_ADMIN", estado="APPROVED".`);
          repairedCount++;
        }
      }
    }

    console.log(`Proceso completado. Se repararon/ajustaron ${repairedCount} membresías.`);
    process.exit(0);
  } catch (error) {
    console.error("Error crítico durante la ejecución del script de reparación:", error);
    process.exit(1);
  }
}

// Ejecutar el script
repairCommunityOwners();
