import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUnreadNotificationsCountAction } from "@/app/actions/notifications";
import { SidebarClient } from "@/components/shared/sidebar-client";

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 1. Obtener pathname de destino inyectado por el middleware/proxy
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "/app";

  console.log(`[Server Layout Log] Rendering for pathname: ${pathname}`);

  // 2. Obtener sesión de Clerk y perfil de Neon DB de forma síncrona
  const user = await getCurrentUser();
  
  if (!user) {
    console.log("[Server Layout Log] No user found. Redirecting to /sign-in");
    redirect("/sign-in");
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });

  console.log("[Server Layout Log] User:", user.id, "Profile exists:", !!profile, "OnboardingCompleted:", profile?.onboardingCompleted);

  // 3. Si el perfil por alguna razón no se pudo aprovisionar y no estamos en onboarding
  if (!profile && pathname !== "/app/onboarding") {
    console.warn("[Server Layout Log] Profile not found for logged-in user in database.");
    // Fallback: Si no existe perfil en la DB, renderizar pantalla de sincronización
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md p-8 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-xl flex flex-col items-center gap-6 text-center shadow-xl relative z-10">
          <div className="h-12 w-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-blue-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Terminando configuración de cuenta</h1>
            <p className="text-xs text-neutral-400 font-light leading-relaxed max-w-xs mx-auto">
              Estamos preparando tu espacio y sincronizando tus credenciales. Esto solo tomará un instante.
            </p>
          </div>
          <a 
            href="/app"
            className="w-full rounded-full bg-white text-neutral-950 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md text-center"
          >
            Verificar nuevamente
          </a>
        </div>
      </div>
    );
  }

  // 4. Si el usuario no ha completado el onboarding y no está en la página de onboarding, redirigir
  if (profile && !profile.onboardingCompleted && pathname !== "/app/onboarding") {
    console.log("[Server Layout Log] Onboarding not completed. Redirecting to /app/onboarding");
    redirect("/app/onboarding");
  }

  // 5. Si ya completó onboarding y trata de acceder a la pantalla de onboarding, redirigir a explorar
  if (profile && profile.onboardingCompleted && pathname === "/app/onboarding") {
    console.log("[Server Layout Log] Onboarding already completed. Redirecting to /app/explore");
    redirect("/app/explore");
  }

  // 6. Si estamos en la página de onboarding, no renderizar la barra lateral de la app
  if (pathname === "/app/onboarding") {
    return <>{children}</>;
  }

  // 7. Calcular las notificaciones no leídas de manera eficiente en el servidor
  let unreadCount = 0;
  try {
    unreadCount = await getUnreadNotificationsCountAction();
  } catch (err) {
    console.error("[Server Layout Log] Error fetching notifications count:", err);
  }

  // 8. Renderizar la barra lateral de cliente pasando los datos precargados del servidor
  return (
    <SidebarClient 
      user={{
        id: user.id,
        email: user.email,
        globalRole: user.globalRole,
        isSuspended: user.isSuspended,
      }} 
      profile={profile ? {
        displayName: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
      } : null}
      initialUnreadCount={unreadCount}
    >
      {children}
    </SidebarClient>
  );
}
