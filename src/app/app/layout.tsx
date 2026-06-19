"use client";

import React, { useState } from "react";
import { Home, Compass, Bell, Settings, User, LogOut, Menu, X, Command } from "lucide-react";
import { UserButton, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigation = [
    { name: "Feed", href: "/app", icon: Home },
    { name: "Comunidades", href: "/app/explore", icon: Compass },
    { name: "Notificaciones", href: "/app/notifications", icon: Bell },
    { name: "Ajustes", href: "/app/settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === "/app") {
      return pathname === "/app";
    }
    return pathname.startsWith(path);
  };

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
                  {item.name}
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
                className={`flex flex-col items-center gap-1 p-2 transition-all duration-200 ${
                  active ? "text-white scale-105" : "text-neutral-500"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[9px] font-medium tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
