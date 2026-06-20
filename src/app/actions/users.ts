"use server";

import { db } from "@/db";
import { users, profiles } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getCurrentUser, requireAuth } from "@/lib/auth-helpers";

export async function getUserRoleAction() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    return {
      globalRole: user.globalRole,
      isSuspended: user.isSuspended,
    };
  } catch (error) {
    console.error("Error fetching user role:", error);
    return null;
  }
}

export async function getUserProfileAction() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, user.id),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        globalRole: user.globalRole,
        isSuspended: user.isSuspended,
      },
      profile: profile ? {
        id: profile.id,
        userId: profile.userId,
        displayName: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio || "",
        website: profile.website || "",
        twitterUrl: profile.twitterUrl || "",
        githubUrl: profile.githubUrl || "",
        isExpert: profile.isExpert,
        expertise: profile.expertise,
        socialLinks: profile.socialLinks || {},
        interests: profile.interests || [],
        skillLevel: profile.skillLevel || "",
        onboardingCompleted: profile.onboardingCompleted,
        discoveryGoals: profile.discoveryGoals || [],
      } : null,
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function submitOnboardingAction(data: {
  displayName: string;
  username: string;
  bio: string;
  interests: string[];
  skillLevel: string;
  discoveryGoals: string[];
  socialLinks: Record<string, string>;
}) {
  try {
    const user = await requireAuth();

    const sanitizedUsername = data.username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (sanitizedUsername.length < 3) {
      return { success: false, error: "El nombre de usuario debe tener al menos 3 caracteres." };
    }

    // Verificar si el username ya está ocupado por otra persona
    const existing = await db.query.profiles.findFirst({
      where: and(
        eq(profiles.username, sanitizedUsername),
        ne(profiles.userId, user.id)
      ),
    });
    if (existing) {
      return { success: false, error: "El nombre de usuario ya está en uso." };
    }

    await db.update(profiles).set({
      displayName: data.displayName.trim(),
      username: sanitizedUsername,
      bio: data.bio.trim(),
      interests: data.interests,
      skillLevel: data.skillLevel,
      discoveryGoals: data.discoveryGoals,
      socialLinks: data.socialLinks,
      onboardingCompleted: true,
      updatedAt: new Date(),
    }).where(eq(profiles.userId, user.id));

    return { success: true };
  } catch (error: any) {
    console.error("Error in submitOnboardingAction:", error);
    return { success: false, error: error.message || "Error al procesar el onboarding." };
  }
}

export async function updateProfileAction(data: {
  displayName: string;
  username: string;
  bio: string;
  website: string;
}) {
  try {
    const user = await requireAuth();

    const sanitizedUsername = data.username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (sanitizedUsername.length < 3) {
      return { success: false, error: "El nombre de usuario debe tener al menos 3 caracteres." };
    }

    const existing = await db.query.profiles.findFirst({
      where: and(
        eq(profiles.username, sanitizedUsername),
        ne(profiles.userId, user.id)
      ),
    });
    if (existing) {
      return { success: false, error: "El nombre de usuario ya está en uso." };
    }

    await db.update(profiles).set({
      displayName: data.displayName.trim(),
      username: sanitizedUsername,
      bio: data.bio.trim(),
      website: data.website.trim(),
      updatedAt: new Date(),
    }).where(eq(profiles.userId, user.id));

    return { success: true };
  } catch (error: any) {
    console.error("Error in updateProfileAction:", error);
    return { success: false, error: error.message || "Error al actualizar el perfil." };
  }
}

export async function updateInterestsAction(data: {
  interests: string[];
  skillLevel: string;
  discoveryGoals: string[];
}) {
  try {
    const user = await requireAuth();

    await db.update(profiles).set({
      interests: data.interests,
      skillLevel: data.skillLevel,
      discoveryGoals: data.discoveryGoals,
      updatedAt: new Date(),
    }).where(eq(profiles.userId, user.id));

    return { success: true };
  } catch (error: any) {
    console.error("Error in updateInterestsAction:", error);
    return { success: false, error: error.message || "Error al actualizar intereses." };
  }
}

export async function updateSocialLinksAction(socialLinks: Record<string, string>) {
  try {
    const user = await requireAuth();

    await db.update(profiles).set({
      socialLinks,
      updatedAt: new Date(),
    }).where(eq(profiles.userId, user.id));

    return { success: true };
  } catch (error: any) {
    console.error("Error in updateSocialLinksAction:", error);
    return { success: false, error: error.message || "Error al actualizar redes sociales." };
  }
}
