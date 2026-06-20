import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { OnboardingClient } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Si la cuenta está suspendida, requireAuth lanzaría error, pero podemos gestionarla
  if (user.isSuspended) {
    redirect("/sign-in");
  }

  // Obtener perfil actual del usuario
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });

  // Si ya completó onboarding, redirigir a /app/explore
  if (profile?.onboardingCompleted) {
    redirect("/app/explore");
  }

  return (
    <OnboardingClient
      initialEmail={user.email}
      initialDisplayName={profile?.displayName || ""}
      initialUsername={profile?.username || ""}
    />
  );
}
