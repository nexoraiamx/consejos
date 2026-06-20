"use client";

import React, { useState, useEffect } from "react";
import { Home, Compass, Bell, Settings, LogOut, Menu, X, Command, Shield } from "lucide-react";
import { UserButton, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUnreadNotificationsCountAction } from "@/app/actions/notifications";

interface SidebarClientProps {
  children: React.ReactNode;
  user: {
    id: string;
    email: string;
    globalRole: string;
    isSuspended: boolean;
  };
  profile: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
  } | null;
  initialUnreadCount: number;
}

export function SidebarClient({
  children,
  user,
  profile,
  initialUnreadCount,
}: SidebarClientProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  const isAdmin = user.globalRole === "GLOBAL_ADMIN";

  useEffect(() => {
    // Actualizar conteo de notificaciones al cambiar de ruta
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

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100 font-sans w-full relative">
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
                  <span className="text-xs font-semibold text-neutral-200">
                    {profile?.displayName || "Mi Cuenta"}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    @{profile?.username || "usuario"}
                  </span>
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
      <div className="flex flex-col flex-1 md:pl-64 min-h-screen relative z-10 w-full">
        <header className="sticky top-0 z-40 md:hidden flex items-center justify-between h-16 px-6 border-b border-neutral-900 bg-neutral-950/70 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white mr-1"
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
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

        {/* MENU LATERAL DESPLEGABLE MÓVIL */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
            
            {/* Drawer */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-neutral-950 border-r border-neutral-900 pt-5 pb-4">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <X className="h-6 w-6 text-white" />
                </button>
              </div>

              <div className="flex-shrink-0 flex items-center px-4 gap-2.5">
                <Command className="h-5 w-5 text-white" />
                <span className="font-heading text-lg font-semibold tracking-tight text-neutral-200">
                  Consejos
                </span>
              </div>
              
              <nav className="mt-8 flex-shrink-0 h-full px-2 space-y-1">
                {navigation.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`group flex items-center px-4 py-2.5 text-base font-medium rounded-2xl transition-all duration-200 ${
                        active
                          ? "bg-neutral-900 border border-neutral-850 text-white"
                          : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40"
                      }`}
                    >
                      <item.icon
                        className={`mr-4 h-5 w-5 flex-shrink-0 transition-colors ${
                          active ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"
                        }`}
                      />
                      <span className="flex-1 text-left">{item.name}</span>
                      {item.name === "Notificaciones" && unreadCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full leading-none">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex-shrink-0 flex border-t border-neutral-900 p-4">
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
                      <span className="text-xs font-semibold text-neutral-200">
                        {profile?.displayName || "Mi Cuenta"}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        @{profile?.username || "usuario"}
                      </span>
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
          </div>
        )}

        {/* Content Wrapper */}
        <main className="flex-1 flex flex-col pb-16 md:pb-0 w-full relative z-10">
          {children}
        </main>

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
