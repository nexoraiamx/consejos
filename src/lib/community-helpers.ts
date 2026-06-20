import { db } from "@/db";
import { communities, communitySlugRedirects } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";

/**
 * Gets a community by slug. If not found, checks for 301 redirects.
 * If redirect exists, performs redirect. Otherwise calls notFound().
 */
export async function getCommunityOrRedirect(slug: string, restOfUrl: string = "") {
  const community = await db.query.communities.findFirst({
    where: and(
      eq(communities.slug, slug),
      isNull(communities.deletedAt)
    ),
  });

  if (!community) {
    const redirectRecord = await db.query.communitySlugRedirects.findFirst({
      where: eq(communitySlugRedirects.oldSlug, slug)
    });
    
    if (redirectRecord) {
      redirect(`/app/r/${redirectRecord.newSlug}${restOfUrl}`);
    }
    
    notFound();
  }

  return community;
}
