import "./db-guard";
import { db, poolDb } from "../src/app/../db";
import { users, profiles, communities, communityMembers, communitySlugRedirects } from "../src/app/../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCommunityOrRedirect } from "../src/app/../lib/community-helpers";

async function runSlugRedirectsTest() {
  console.log("Iniciando pruebas de redirecciones de slugs de comunidades...");

  const userIdCreator = "user_test_slug_creator";
  const originalSlug = "slug-test-a";
  const secondSlug = "slug-test-b";
  const thirdSlug = "slug-test-c";

  try {
    // 1. Limpiar datos de prueba previos
    console.log("Limpiando datos de prueba previos...");
    const testCommIds = await db
      .select({ id: communities.id })
      .from(communities)
      .where(
        and(
          eq(communities.creatorId, userIdCreator)
        )
      );

    if (testCommIds.length > 0) {
      const ids = testCommIds.map((c) => c.id);
      await db.delete(communitySlugRedirects).where(eq(communitySlugRedirects.communityId, ids[0])).execute();
      await db.delete(communityMembers).where(eq(communityMembers.communityId, ids[0])).execute();
      await db.delete(communities).where(eq(communities.id, ids[0])).execute();
    }

    await db.delete(profiles).where(eq(profiles.userId, userIdCreator)).execute();
    await db.delete(users).where(eq(users.id, userIdCreator)).execute();

    // 2. Sembrar usuario de prueba
    console.log("Creando usuario creador...");
    await db.insert(users).values({ id: userIdCreator, email: "slugcreator@test.com", globalRole: "MEMBER" });
    await db.insert(profiles).values({ userId: userIdCreator, displayName: "Slug Creator", username: "slug_creator" });

    // 3. Crear comunidad original con slug-test-a
    console.log("Creando comunidad original...");
    const [community] = await db.insert(communities).values({
      slug: originalSlug,
      displayName: "Comunidad de Slugs",
      description: "Descripción de prueba",
      privacyType: "PUBLIC",
      creatorId: userIdCreator,
    }).returning();

    await db.insert(communityMembers).values({
      communityId: community.id,
      userId: userIdCreator,
      role: "COMMUNITY_ADMIN",
      status: "APPROVED",
    });

    console.log(`Comunidad creada con ID: ${community.id} y slug: "${originalSlug}"`);

    // Helper para capturar redirect de Next.js
    const assertRedirect = async (slugToCheck: string, rest: string, expectedTarget: string) => {
      try {
        await getCommunityOrRedirect(slugToCheck, rest);
        throw new Error(`ERROR: Se esperaba una redirección para el slug "${slugToCheck}", pero devolvió la comunidad.`);
      } catch (err: any) {
        if (err && err.digest && err.digest.startsWith("NEXT_REDIRECT;")) {
          // El digest de redirect de Next.js tiene el formato: NEXT_REDIRECT;307;URL;...
          const parts = err.digest.split(";");
          const targetUrl = parts[2];
          if (targetUrl === expectedTarget) {
            console.log(`ÉXITO: El slug "${slugToCheck}" con subruta "${rest}" redirigió correctamente a "${expectedTarget}"`);
          } else {
            throw new Error(`ERROR: Redirección incorrecta. Esperada: "${expectedTarget}", Obtenida: "${targetUrl}"`);
          }
        } else {
          throw err;
        }
      }
    };

    // Helper para capturar notFound de Next.js
    const assertNotFound = async (slugToCheck: string) => {
      try {
        await getCommunityOrRedirect(slugToCheck);
        throw new Error(`ERROR: Se esperaba error notFound para "${slugToCheck}", pero devolvió la comunidad.`);
      } catch (err: any) {
        if (err && (err.digest === "NEXT_NOT_FOUND" || err.digest === "NEXT_HTTP_ERROR_FALLBACK;404")) {
          console.log(`ÉXITO: El slug "${slugToCheck}" devolvió correctamente NOT_FOUND.`);
        } else {
          throw err;
        }
      }
    };

    // --- Prueba A: Acceso inicial sin redirecciones ---
    console.log("\n--- Prueba A: Acceso inicial ---");
    const c1 = await getCommunityOrRedirect(originalSlug);
    if (c1.id !== community.id) {
      throw new Error("ERROR: getCommunityOrRedirect no devolvió la comunidad correcta.");
    }
    console.log("ÉXITO: Se obtuvo la comunidad directamente usando su slug activo.");
    await assertNotFound("slug-no-existente");

    // --- Prueba B: Primer cambio de slug (slug-test-a -> slug-test-b) ---
    console.log("\n--- Prueba B: Primer cambio de slug ---");
    await poolDb.transaction(async (tx) => {
      // Actualizar comunidad
      await tx.update(communities)
        .set({ slug: secondSlug, displayName: "Comunidad de Slugs Renovada" })
        .where(eq(communities.id, community.id));

      // Insertar redirect
      await tx.insert(communitySlugRedirects).values({
        oldSlug: originalSlug,
        newSlug: secondSlug,
        communityId: community.id,
      });
    });
    console.log(`Slug actualizado de "${originalSlug}" a "${secondSlug}"`);

    // Verificar que el slug activo funciona
    const c2 = await getCommunityOrRedirect(secondSlug);
    if (c2.slug !== secondSlug) {
      throw new Error("ERROR: El slug activo de la comunidad no se actualizó.");
    }
    console.log("ÉXITO: Se puede acceder a la comunidad a través de su nuevo slug activo.");

    // Verificar que el slug antiguo redirige (incluyendo subrutas)
    await assertRedirect(originalSlug, "", `/app/r/${secondSlug}`);
    await assertRedirect(originalSlug, "/admin", `/app/r/${secondSlug}/admin`);

    // --- Prueba C: Segundo cambio de slug (slug-test-b -> slug-test-c) ---
    console.log("\n--- Prueba C: Segundo cambio de slug ---");
    await poolDb.transaction(async (tx) => {
      // Actualizar comunidad
      await tx.update(communities)
        .set({ slug: thirdSlug })
        .where(eq(communities.id, community.id));

      // Insertar nuevo redirect
      await tx.insert(communitySlugRedirects).values({
        oldSlug: secondSlug,
        newSlug: thirdSlug,
        communityId: community.id,
      });

      // Actualizar redirecciones anteriores
      await tx.update(communitySlugRedirects)
        .set({ newSlug: thirdSlug })
        .where(and(
          eq(communitySlugRedirects.communityId, community.id),
          eq(communitySlugRedirects.newSlug, secondSlug)
        ));
    });
    console.log(`Slug actualizado de "${secondSlug}" a "${thirdSlug}"`);

    // Verificar redirecciones encadenadas
    await assertRedirect(originalSlug, "", `/app/r/${thirdSlug}`);
    await assertRedirect(originalSlug, "/moderation", `/app/r/${thirdSlug}/moderation`);
    await assertRedirect(secondSlug, "", `/app/r/${thirdSlug}`);
    await assertRedirect(secondSlug, "/new", `/app/r/${thirdSlug}/new`);

    // --- Prueba D: Volver al slug original (slug-test-c -> slug-test-a) ---
    console.log("\n--- Prueba D: Volver al slug original (recircular) ---");
    await poolDb.transaction(async (tx) => {
      // Actualizar comunidad
      await tx.update(communities)
        .set({ slug: originalSlug })
        .where(eq(communities.id, community.id));

      // Eliminar redirect viejo para evitar bucles
      await tx.delete(communitySlugRedirects)
        .where(eq(communitySlugRedirects.oldSlug, originalSlug));

      // Insertar nuevo redirect
      await tx.insert(communitySlugRedirects).values({
        oldSlug: thirdSlug,
        newSlug: originalSlug,
        communityId: community.id,
      });

      // Actualizar redirecciones anteriores
      await tx.update(communitySlugRedirects)
        .set({ newSlug: originalSlug })
        .where(and(
          eq(communitySlugRedirects.communityId, community.id),
          eq(communitySlugRedirects.newSlug, thirdSlug)
        ));
    });
    console.log(`Slug devuelto a "${originalSlug}"`);

    // Verificar que el slug original vuelve a ser el activo directamente
    const c3 = await getCommunityOrRedirect(originalSlug);
    if (c3.slug !== originalSlug) {
      throw new Error("ERROR: No se pudo volver a acceder por el slug original.");
    }
    console.log("ÉXITO: Se puede volver a acceder a la comunidad directamente con el slug original.");

    // Verificar que los slugs intermedios ahora redirigen al original
    await assertRedirect(secondSlug, "", `/app/r/${originalSlug}`);
    await assertRedirect(thirdSlug, "/admin", `/app/r/${originalSlug}/admin`);

    // 4. Limpieza final
    console.log("\nLimpiando datos sembrados...");
    await db.delete(communitySlugRedirects).where(eq(communitySlugRedirects.communityId, community.id)).execute();
    await db.delete(communityMembers).where(eq(communityMembers.communityId, community.id)).execute();
    await db.delete(communities).where(eq(communities.id, community.id)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdCreator)).execute();
    await db.delete(users).where(eq(users.id, userIdCreator)).execute();

    console.log("¡Todas las pruebas pasaron satisfactoriamente!");
    process.exit(0);
  } catch (error) {
    console.error("Prueba fallida con error:", error);
    process.exit(1);
  }
}

runSlugRedirectsTest();
