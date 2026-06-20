"use client";

import React, { useState, useEffect } from "react";
import { Home, Compass, Bell, Settings, User, LogOut, Menu, X, Command, Shield } from "lucide-react";
import { useUser, UserButton, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUserProfileAction } from "@/app/actions/users";
import { getUnreadNotificationsCountAction } from "@/app/actions/notifications";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOnboardingChecking, setIsOnboardingChecking] = useState(true);
  const [profileExists, setProfileExists] = useState<boolean | null>(null); // null = loading, false = not synced, true = synced

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setIsOnboardingChecking(false);
      return;
    }

    getUserProfileAction().then((res) => {
      if (res && res.profile) {
        setProfileExists(true);
        if (res.user.globalRole === "GLOBAL_ADMIN") {
          setIsAdmin(true);
        }
        if (!res.profile.onboardingCompleted && pathname !== "/app/onboarding") {
          router.replace("/app/onboarding");
        } else {
          setIsOnboardingChecking(false);
        }
      } else {
        setProfileExists(false);
        setIsOnboardingChecking(false);
      }
    }).catch((err) => {
      console.error("Error fetching user profile in layout:", err);
      setProfileExists(false);
      setIsOnboardingChecking(false);
    });
  }, [isLoaded, isSignedIn, pathname, router]);

  useEffect(() => {
    getUnreadNotificationsCountAction().then((count) => {
      setUnreadCount(count);
    });
  }, [pathname]);

  const navigation = [
    { name: "Feed", href: "/app", icon: Home },
    { name: "Comunidades", href: "/app/explore", icon: Compass },
    { name: "Notificaciones", href: "/app/notifications", icon: Bell },
    { name: "Ajustes", href: "/app/settings", icon: Settings },
    ...(isAdmin ? [{ name: "Admin", href: "/app/admin", icon: Shield }] : []),
  ];

  const isActive = (path: string) => {
    if (path === "/app") {
      return pathname === "/app";
    }
    return pathname.startsWith(path);
  };

  // No bloquear onboarding
  if (pathname === "/app/onboarding") {
    return <>{children}</>;
  }

  // Si está autenticado en Clerk pero el perfil no se ha sincronizado en Neon
  if (isSignedIn && profileExists === false) {
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
              Estamos preparando tu espacio en Consejos y sincronizando tus credenciales de Clerk. Esto solo tomará unos segundos.
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full rounded-full bg-white text-neutral-950 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md"
          >
            Verificar nuevamente
          </button>
        </div>
      </div>
    );
  }

  if (isOnboardingChecking || !isLoaded) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <span className="text-xs font-light tracking-wide">Cargando perfil...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      {/* Fondo con gradiente sutil al estilo Apple/Linear */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,rgba(120,119,198,0.04),rgba(255,255,255,0))]" />

      {/* SIDEBAR DESKTOP - Slim & Premium (estilo Arc/Linear) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-neutral-900 bg-neutral-950/60 backdrop-blur-lg z-30">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo / Branding */}
          <div className="flex items-center h-16 px-6 border-b border-neutral-900/60 gap-2.5">
            <Command className="h-5 w-5 text-white" />
            <span className="font-heading text-lg font-semibold tracking-tight text-neutral-200">
              Consejos
            </span>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-4 py-2.5 text-sm font-medium rounded-2xl transition-all duration-200 ${
                    active
                      ? "bg-neutral-900 border border-neutral-850 text-white shadow-sm shadow-black/20"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-4.5 w-4.5 flex-shrink-0 transition-colors ${
                      active ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"
                    }`}
                  />
                  <span className="flex-1 text-left">{item.name}</span>
                  {item.name === "Notificaciones" && unreadCount > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Profile Footer Section */}
          <div className="flex-shrink-0 flex border-t border-neutral-900/60 p-4 bg-neutral-950/20">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "h-8 w-8 rounded-full border border-neutral-800",
                    },
                  }}
                />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-neutral-200">Mi Cuenta</span>
                  <span className="text-[10px] text-neutral-500">Panel Personal</span>
                </div>
              </div>
              
              <SignOutButton>
                <button className="p-2 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-950/10 transition-all cursor-pointer">
                  <LogOut className="h-4 w-4" />
                </button>
              </SignOutButton>
            </div>
          </div>
        </div>
      </aside>

      {/* TOP HEADER MOBILE & MOBILE LAYOUT */}
      <div className="flex flex-col flex-1 md:pl-64 min-h-screen relative z-10">
        <header className="sticky top-0 z-40 md:hidden flex items-center justify-between h-16 px-6 border-b border-neutral-900 bg-neutral-950/70 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Command className="h-4.5 w-4.5 text-white" />
            <span className="font-heading text-base font-semibold tracking-tight text-neutral-200">
              Consejos
            </span>
          </div>

          <div className="flex items-center gap-4">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "h-7 w-7 rounded-full border border-neutral-800",
                },
              }}
            />
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col pb-16 md:pb-0">
          {children}
        </div>

        {/* BOTTOM NAVIGATION MOBILE */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-neutral-900 bg-neutral-950/80 backdrop-blur-lg px-6 py-2 flex items-center justify-around">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center gap-1 p-2 transition-all duration-200 relative ${
                  active ? "text-white scale-105" : "text-neutral-500"
                }`}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.name === "Notificaciones" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
                  )}
                </div>
                <span className="text-[9px] font-medium tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
