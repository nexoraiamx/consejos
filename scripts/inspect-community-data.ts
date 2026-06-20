import { db } from "../src/db";
import { communities, communityMembers, posts, comments, attachments } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function inspectData() {
  console.log("=== INSPECCIÓN DE DATOS DE COMUNIDAD: 'hola' ===");
  try {
    const comm = await db.query.communities.findFirst({
      where: eq(communities.slug, "hola")
    });

    if (!comm) {
      console.log("No se encontró ninguna comunidad con el slug 'hola'.");
      return;
    }

    console.log("Comunidad encontrada:");
    console.log({
      id: comm.id,
      slug: comm.slug,
      displayName: comm.displayName,
      deletedAt: comm.deletedAt,
      privacyType: comm.privacyType,
      creatorId: comm.creatorId
    });

    const members = await db.query.communityMembers.findMany({
      where: eq(communityMembers.communityId, comm.id)
    });
    console.log(`\nMiembros de la comunidad (${members.length}):`);
    members.forEach(m => {
      console.log(`- UserID: ${m.userId}, Role: ${m.role}, Status: ${m.status}`);
    });

    const communityPosts = await db.query.posts.findMany({
      where: eq(posts.communityId, comm.id)
    });
    console.log(`\nPosts de la comunidad (${communityPosts.length}):`);
    communityPosts.forEach(p => {
      console.log(`- PostID: ${p.id}, Title: "${p.title}", AuthorID: ${p.authorId}, Status: ${p.status}, DeletedAt: ${p.deletedAt}`);
    });

    if (communityPosts.length > 0) {
      const postIds = communityPosts.map(p => p.id);
      
      const postComments = await db.query.comments.findMany({
        where: (commentsTable, { inArray }) => inArray(commentsTable.postId, postIds)
      });
      console.log(`\nComments asociados a los posts (${postComments.length}):`);
      postComments.forEach(c => {
        console.log(`- CommentID: ${c.id}, PostID: ${c.postId}, AuthorID: ${c.authorId}, Status: ${c.status}, DeletedAt: ${c.deletedAt}`);
      });

      const postAttachments = await db.query.attachments.findMany({
        where: (attachmentsTable, { inArray, or, and, eq }) => or(
          and(eq(attachmentsTable.targetType, "POST"), inArray(attachmentsTable.targetId, postIds)),
          eq(attachmentsTable.targetId, comm.id)
        )
      });
      console.log(`\nAttachments asociados (${postAttachments.length}):`);
      postAttachments.forEach(a => {
        console.log(`- AttachmentID: ${a.id}, TargetType: ${a.targetType}, TargetID: ${a.targetId}, Key: ${a.fileKey}`);
      });
    }
  } catch (error) {
    console.error("Error al consultar datos:", error);
  }
}

inspectData();
