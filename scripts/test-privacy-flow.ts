import "./db-guard";
import { db } from "@/db";
import { users, profiles, communities, communityMembers, posts, comments, auditLogs, userReputation } from "@/db/schema";
import { eq, and, isNull, or, sql, desc } from "drizzle-orm";

async function testPrivacyFlow() {
  console.log("Iniciando flujo de prueba automatizada para privacidad e imágenes de comunidades...");

  // IDs de prueba
  const userIdNormal = "user_test_privacy_normal";
  const userIdAdmin = "user_test_privacy_admin";
  const userIdGlobalAdmin = "user_test_privacy_global_admin";

  const slugPublic = "comm-test-privacy-public";
  const slugPrivate = "comm-test-privacy-private";
  const slugInvite = "comm-test-privacy-invite";

  try {
    // 1. Limpieza de datos anteriores por seguridad
    console.log("Limpiando datos residuales de prueba...");
    
    // Obtener IDs de comunidades de prueba anteriores
    const oldComms = await db.select({ id: communities.id }).from(communities).where(
      or(
        eq(communities.slug, slugPublic),
        eq(communities.slug, slugPrivate),
        eq(communities.slug, slugInvite)
      )
    );
    const commIds = oldComms.map(c => c.id);

    if (commIds.length > 0) {
      await db.delete(posts).where(sql`${posts.communityId} IN ${commIds}`).execute();
      await db.delete(communityMembers).where(sql`${communityMembers.communityId} IN ${commIds}`).execute();
      await db.delete(communities).where(sql`${communities.id} IN ${commIds}`).execute();
    }

    await db.delete(userReputation).where(sql`${userReputation.userId} IN (${userIdNormal}, ${userIdAdmin}, ${userIdGlobalAdmin})`).execute();
    await db.delete(profiles).where(sql`${profiles.userId} IN (${userIdNormal}, ${userIdAdmin}, ${userIdGlobalAdmin})`).execute();
    await db.delete(users).where(sql`${users.id} IN (${userIdNormal}, ${userIdAdmin}, ${userIdGlobalAdmin})`).execute();

    // 2. Sembrar Usuarios
    console.log("Creando usuarios de prueba...");
    await db.insert(users).values([
      { id: userIdNormal, email: "normal@privacy.com", globalRole: "MEMBER" },
      { id: userIdAdmin, email: "admin@privacy.com", globalRole: "MEMBER" },
      { id: userIdGlobalAdmin, email: "global@privacy.com", globalRole: "GLOBAL_ADMIN" },
    ]);
    await db.insert(profiles).values([
      { userId: userIdNormal, displayName: "Normal User", username: "test_privacy_normal" },
      { userId: userIdAdmin, displayName: "Community Admin User", username: "test_privacy_admin" },
      { userId: userIdGlobalAdmin, displayName: "Global Admin User", username: "test_privacy_global" },
    ]);
    await db.insert(userReputation).values([
      { userId: userIdNormal, score: 0, level: 1 },
      { userId: userIdAdmin, score: 0, level: 1 },
      { userId: userIdGlobalAdmin, score: 0, level: 1 },
    ]);

    // 3. Sembrar Comunidades (Con avatar_url, banner_url, category)
    console.log("Creando comunidades con imágenes y categorías...");
    const [commPublic] = await db.insert(communities).values({
      slug: slugPublic,
      displayName: "Public Community",
      privacyType: "PUBLIC",
      creatorId: userIdAdmin,
      avatarUrl: "https://r2.consejos.nexorai.mx/uploads/avatar_public.png",
      bannerUrl: "https://r2.consejos.nexorai.mx/uploads/banner_public.png",
      category: "Tecnología",
    }).returning();

    const [commPrivate] = await db.insert(communities).values({
      slug: slugPrivate,
      displayName: "Private Community",
      privacyType: "PRIVATE",
      creatorId: userIdAdmin,
      avatarUrl: "https://r2.consejos.nexorai.mx/uploads/avatar_private.png",
      bannerUrl: "https://r2.consejos.nexorai.mx/uploads/banner_private.png",
      category: "Diseño",
    }).returning();

    const [commInvite] = await db.insert(communities).values({
      slug: slugInvite,
      displayName: "Invite Only Community",
      privacyType: "INVITE_ONLY",
      creatorId: userIdAdmin,
      avatarUrl: "https://r2.consejos.nexorai.mx/uploads/avatar_invite.png",
      bannerUrl: "https://r2.consejos.nexorai.mx/uploads/banner_invite.png",
      category: "Recursos",
    }).returning();

    console.log("Comunidades creadas con éxito. Validando campos guardados...");
    if (commPublic.avatarUrl !== "https://r2.consejos.nexorai.mx/uploads/avatar_public.png" || commPublic.category !== "Tecnología") {
      throw new Error("Error: Los campos avatarUrl o category no se guardaron correctamente en la comunidad pública.");
    }
    if (commPrivate.bannerUrl !== "https://r2.consejos.nexorai.mx/uploads/banner_private.png" || commPrivate.category !== "Diseño") {
      throw new Error("Error: Los campos bannerUrl o category no se guardaron correctamente en la comunidad privada.");
    }
    console.log("-> Campos de imágenes y categoría verificados correctamente en DB.");

    // Agregar membresía de administrador de la comunidad para userIdAdmin
    await db.insert(communityMembers).values([
      { communityId: commPublic.id, userId: userIdAdmin, role: "COMMUNITY_ADMIN", status: "APPROVED" },
      { communityId: commPrivate.id, userId: userIdAdmin, role: "COMMUNITY_ADMIN", status: "APPROVED" },
      { communityId: commInvite.id, userId: userIdAdmin, role: "COMMUNITY_ADMIN", status: "APPROVED" },
    ]);

    // 4. Sembrar Publicaciones (Active y Hidden)
    console.log("Sembrando publicaciones...");
    const [postPublicActive] = await db.insert(posts).values({
      communityId: commPublic.id,
      authorId: userIdAdmin,
      title: "Public Active Post",
      content: "This is a public active post",
      postType: "DISCUSSION",
      status: "ACTIVE",
    }).returning();

    const [postPrivateActive] = await db.insert(posts).values({
      communityId: commPrivate.id,
      authorId: userIdAdmin,
      title: "Private Active Post",
      content: "This is a private active post",
      postType: "DISCUSSION",
      status: "ACTIVE",
    }).returning();

    const [postPrivateHidden] = await db.insert(posts).values({
      communityId: commPrivate.id,
      authorId: userIdAdmin,
      title: "Private Hidden Post",
      content: "This is a private hidden post",
      postType: "DISCUSSION",
      status: "HIDDEN",
    }).returning();

    const [postInviteActive] = await db.insert(posts).values({
      communityId: commInvite.id,
      authorId: userIdAdmin,
      title: "Invite Active Post",
      content: "This is an invite-only active post",
      postType: "DISCUSSION",
      status: "ACTIVE",
    }).returning();

    // Helper para emular la consulta del feed en src/app/app/page.tsx
    const queryFeed = async (simulatedUser: { id: string; globalRole: string } | null) => {
      const currentUserId = simulatedUser?.id || "";
      const isGlobalAdmin = simulatedUser?.globalRole === "GLOBAL_ADMIN";

      const whereClause = isGlobalAdmin
        ? and(
            isNull(posts.deletedAt),
            isNull(communities.deletedAt),
            or(
              eq(posts.status, "ACTIVE"),
              eq(posts.status, "HIDDEN")
            )
          )
        : and(
            isNull(posts.deletedAt),
            isNull(communities.deletedAt),
            or(
              // Public active posts
              and(
                eq(posts.status, "ACTIVE"),
                eq(communities.privacyType, "PUBLIC")
              ),
              // Private or invite-only active posts where user is approved member
              and(
                eq(posts.status, "ACTIVE"),
                or(
                  eq(communities.privacyType, "PRIVATE"),
                  eq(communities.privacyType, "INVITE_ONLY")
                ),
                or(
                  eq(communityMembers.status, "APPROVED"),
                  eq(communityMembers.status, "approved")
                )
              ),
              // Hidden posts where user is owner, community admin, moderator, or community creator
              simulatedUser
                ? and(
                    eq(posts.status, "HIDDEN"),
                    or(
                      and(
                        or(
                          eq(communityMembers.role, "owner"),
                          eq(communityMembers.role, "COMMUNITY_ADMIN"),
                          eq(communityMembers.role, "community_admin"),
                          eq(communityMembers.role, "MODERATOR"),
                          eq(communityMembers.role, "moderator")
                        ),
                        or(
                          eq(communityMembers.status, "APPROVED"),
                          eq(communityMembers.status, "approved")
                        )
                      ),
                      eq(communities.creatorId, simulatedUser.id)
                    )
                  )
                : sql`false`
            )
          );

      const allPosts = await db
        .select({
          id: posts.id,
          title: posts.title,
          status: posts.status,
          communitySlug: communities.slug,
        })
        .from(posts)
        .innerJoin(communities, eq(posts.communityId, communities.id))
        .leftJoin(
          communityMembers,
          and(
            eq(communityMembers.communityId, posts.communityId),
            eq(communityMembers.userId, currentUserId)
          )
        )
        .where(whereClause)
        .orderBy(desc(posts.createdAt));

      return allPosts.filter(p => [slugPublic, slugPrivate, slugInvite].includes(p.communitySlug));
    };

    // 5. EJECUTAR CASOS DE PRUEBA DE VISIBILIDAD DE FEEDS

    console.log("\n=== PRUEBAS DE FEED ===");

    // Caso 1: Usuario Invitado (Sin login)
    console.log("Caso 1: Ejecutando feed para Invitado (sin login)...");
    const feedGuest = await queryFeed(null);
    console.log(`-> Resultados devueltos: ${feedGuest.length} posts.`);
    feedGuest.forEach(p => console.log(`   - Post: "${p.title}" (${p.communitySlug}) [${p.status}]`));
    
    if (feedGuest.length !== 1 || feedGuest[0].id !== postPublicActive.id) {
      throw new Error("Error: El invitado debería ver únicamente la publicación activa de la comunidad pública.");
    }
    console.log("-> Caso 1 exitoso.");

    // Caso 2: Usuario Normal (Registrado, no miembro de privada ni invitación)
    console.log("\nCaso 2: Ejecutando feed para Usuario Normal (no miembro)...");
    const feedNormal = await queryFeed({ id: userIdNormal, globalRole: "MEMBER" });
    console.log(`-> Resultados devueltos: ${feedNormal.length} posts.`);
    feedNormal.forEach(p => console.log(`   - Post: "${p.title}" (${p.communitySlug}) [${p.status}]`));
    
    if (feedNormal.length !== 1 || feedNormal[0].id !== postPublicActive.id) {
      throw new Error("Error: El usuario normal no miembro debería ver únicamente la publicación pública.");
    }
    console.log("-> Caso 2 exitoso.");

    // Caso 3: Usuario Normal se une y es aprobado en la Comunidad Privada
    console.log("\nCaso 3: Usuario Normal se une a la comunidad privada...");
    await db.insert(communityMembers).values({
      communityId: commPrivate.id,
      userId: userIdNormal,
      role: "MEMBER",
      status: "APPROVED",
    });

    const feedNormalJoined = await queryFeed({ id: userIdNormal, globalRole: "MEMBER" });
    console.log(`-> Resultados devueltos: ${feedNormalJoined.length} posts.`);
    feedNormalJoined.forEach(p => console.log(`   - Post: "${p.title}" (${p.communitySlug}) [${p.status}]`));

    const containsPublic = feedNormalJoined.some(p => p.id === postPublicActive.id);
    const containsPrivate = feedNormalJoined.some(p => p.id === postPrivateActive.id);
    const containsHidden = feedNormalJoined.some(p => p.id === postPrivateHidden.id);

    if (!containsPublic || !containsPrivate || feedNormalJoined.length !== 2) {
      throw new Error("Error: El usuario normal aprobado debería ver exactamente 2 posts (público y privado activo).");
    }
    if (containsHidden) {
      throw new Error("Error: El usuario normal miembro no debería ver la publicación oculta (HIDDEN).");
    }
    console.log("-> Caso 3 exitoso.");

    // Caso 4: Administrador de la comunidad privada ejecuta el feed
    console.log("\nCaso 4: Ejecutando feed para Administrador de la Comunidad (userIdAdmin)...");
    const feedAdmin = await queryFeed({ id: userIdAdmin, globalRole: "MEMBER" });
    console.log(`-> Resultados devueltos: ${feedAdmin.length} posts.`);
    feedAdmin.forEach(p => console.log(`   - Post: "${p.title}" (${p.communitySlug}) [${p.status}]`));

    const containsHiddenForAdmin = feedAdmin.some(p => p.id === postPrivateHidden.id);
    if (!containsHiddenForAdmin) {
      throw new Error("Error: El administrador de la comunidad debería poder ver la publicación oculta (HIDDEN) de su comunidad.");
    }
    console.log("-> Caso 4 exitoso.");

    // Caso 5: Administrador Global ejecuta el feed
    console.log("\nCaso 5: Ejecutando feed para Administrador Global (userIdGlobalAdmin)...");
    const feedGlobalAdmin = await queryFeed({ id: userIdGlobalAdmin, globalRole: "GLOBAL_ADMIN" });
    console.log(`-> Resultados devueltos: ${feedGlobalAdmin.length} posts.`);
    feedGlobalAdmin.forEach(p => console.log(`   - Post: "${p.title}" (${p.communitySlug}) [${p.status}]`));

    // El Administrador Global debería ver todos los posts (público activo, privado activo, privado oculto, invitación activo)
    if (feedGlobalAdmin.length !== 4) {
      throw new Error("Error: El Administrador Global debería ver exactamente los 4 posts creados.");
    }
    console.log("-> Caso 5 exitoso.");

    // 6. EJECUTAR CASOS DE PRUEBA DE ACCESO A DETALLE DE POSTS

    console.log("\n=== PRUEBAS DE DETALLE DE POSTS ===");

    // Helper para verificar acceso a detalle de post emulando src/app/app/r/[slug]/post/[postId]/page.tsx
    const checkPostAccess = (
      post: { id: string; status: string; communityId: string },
      community: { id: string; privacyType: string },
      membership: { role: string; status: string } | null,
      user: { id: string; globalRole: string } | null
    ) => {
      const isGlobalAdmin = user?.globalRole === "GLOBAL_ADMIN";
      const isJoined = membership?.status.toUpperCase() === "APPROVED";

      // 1. Privacidad de la comunidad
      const hasAccess = community.privacyType === "PUBLIC" || isJoined || isGlobalAdmin;
      if (!hasAccess) return { allowed: false, reason: "RESTRICTED_PRIVACY" };

      // 2. Moderador local
      let canModerate = isGlobalAdmin;
      if (user && !isGlobalAdmin && membership) {
        const roleLower = membership.role.toLowerCase();
        if (
          (roleLower === "owner" || roleLower === "community_admin" || roleLower === "moderator") &&
          membership.status.toUpperCase() === "APPROVED"
        ) {
          canModerate = true;
        }
      }

      // 3. Post oculto
      const isPostHidden = post.status === "HIDDEN";
      const canViewHiddenPost = canModerate || isGlobalAdmin;
      
      if (isPostHidden && !canViewHiddenPost) {
        return { allowed: false, reason: "RESTRICTED_HIDDEN" };
      }

      if (post.status === "DELETED") {
        return { allowed: false, reason: "DELETED" };
      }

      return { allowed: true };
    };

    // Caso A: Normal intenta entrar a post de invitación (no miembro)
    console.log("Caso A: Usuario normal (no miembro) intenta leer post en comunidad de invitación...");
    const accessNormalToInvite = checkPostAccess(postInviteActive, commInvite, null, { id: userIdNormal, globalRole: "MEMBER" });
    console.log(`-> Resultado: permitido = ${accessNormalToInvite.allowed}, razón = ${accessNormalToInvite.reason || "ninguna"}`);
    if (accessNormalToInvite.allowed) {
      throw new Error("Error: Se permitió acceso a un post de invitación a un no miembro.");
    }
    console.log("-> Caso A exitoso.");

    // Caso B: Miembro aprobado intenta entrar a post activo privado
    console.log("\nCaso B: Miembro aprobado de comunidad privada intenta leer post privado activo...");
    const accessNormalToPrivate = checkPostAccess(
      postPrivateActive, 
      commPrivate, 
      { role: "MEMBER", status: "APPROVED" }, 
      { id: userIdNormal, globalRole: "MEMBER" }
    );
    console.log(`-> Resultado: permitido = ${accessNormalToPrivate.allowed}`);
    if (!accessNormalToPrivate.allowed) {
      throw new Error("Error: Se denegó acceso a un post privado a un miembro aprobado.");
    }
    console.log("-> Caso B exitoso.");

    // Caso C: Miembro normal (no admin/mod) intenta entrar a post oculto (HIDDEN)
    console.log("\nCaso C: Miembro normal (no admin/mod) intenta leer post oculto (HIDDEN)...");
    const accessNormalToHidden = checkPostAccess(
      postPrivateHidden,
      commPrivate,
      { role: "MEMBER", status: "APPROVED" },
      { id: userIdNormal, globalRole: "MEMBER" }
    );
    console.log(`-> Resultado: permitido = ${accessNormalToHidden.allowed}, razón = ${accessNormalToHidden.reason || "ninguna"}`);
    if (accessNormalToHidden.allowed) {
      throw new Error("Error: Se permitió a un miembro regular leer una publicación oculta (HIDDEN).");
    }
    console.log("-> Caso C exitoso.");

    // Caso D: Moderador intenta entrar a post oculto (HIDDEN)
    console.log("\nCaso D: Administrador local intenta leer post oculto (HIDDEN)...");
    const accessAdminToHidden = checkPostAccess(
      postPrivateHidden,
      commPrivate,
      { role: "COMMUNITY_ADMIN", status: "APPROVED" },
      { id: userIdAdmin, globalRole: "MEMBER" }
    );
    console.log(`-> Resultado: permitido = ${accessAdminToHidden.allowed}`);
    if (!accessAdminToHidden.allowed) {
      throw new Error("Error: Se denegó el acceso a un post oculto al administrador de la comunidad.");
    }
    console.log("-> Caso D exitoso.");

    // Caso E: Global Admin intenta entrar a post oculto (HIDDEN)
    console.log("\nCaso E: Administrador global intenta leer post oculto (HIDDEN)...");
    const accessGlobalToHidden = checkPostAccess(
      postPrivateHidden,
      commPrivate,
      null, // no requiere membresía local
      { id: userIdGlobalAdmin, globalRole: "GLOBAL_ADMIN" }
    );
    console.log(`-> Resultado: permitido = ${accessGlobalToHidden.allowed}`);
    if (!accessGlobalToHidden.allowed) {
      throw new Error("Error: Se denegó el acceso a un post oculto al Administrador Global.");
    }
    console.log("-> Caso E exitoso.");

    // 7. Limpiar datos creados tras completar las pruebas
    console.log("\nLimpiando base de datos después de la prueba...");
    const commIdsToClean = [commPublic.id, commPrivate.id, commInvite.id];
    
    await db.delete(posts).where(sql`${posts.communityId} IN ${commIdsToClean}`).execute();
    await db.delete(communityMembers).where(sql`${communityMembers.communityId} IN ${commIdsToClean}`).execute();
    await db.delete(communities).where(sql`${communities.id} IN ${commIdsToClean}`).execute();
    await db.delete(userReputation).where(sql`${userReputation.userId} IN (${userIdNormal}, ${userIdAdmin}, ${userIdGlobalAdmin})`).execute();
    await db.delete(profiles).where(sql`${profiles.userId} IN (${userIdNormal}, ${userIdAdmin}, ${userIdGlobalAdmin})`).execute();
    await db.delete(users).where(sql`${users.id} IN (${userIdNormal}, ${userIdAdmin}, ${userIdGlobalAdmin})`).execute();

    console.log("\n¡Prueba de flujo completada exitosamente! Todos los casos de visibilidad y acceso pasaron.");
  } catch (error) {
    console.error("\nFallo en la prueba de flujo de privacidad:", error);
    process.exit(1);
  }
}

testPrivacyFlow();
