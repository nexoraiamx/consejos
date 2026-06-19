import React from "react";
import { Metadata } from "next";
import { getUserNotificationsAction } from "@/app/actions/notifications";
import NotificationsClient from "./notifications-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notificaciones | Consejos",
  description: "Revisa tus notificaciones de comentarios, respuestas de expertos, reputación y moderación.",
};

export default async function NotificationsPage() {
  const notifications = await getUserNotificationsAction();

  return <NotificationsClient initialNotifications={notifications} />;
}
