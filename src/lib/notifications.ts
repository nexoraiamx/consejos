import { poolDb } from "@/db";
import { notifications } from "@/db/schema";

import { SYSTEM_TARGET_ID } from "@/lib/constants";

interface CreateNotificationInput {
  recipientId: string;
  senderId: string | null;
  type: "COMMENT" | "MENTION" | "REACTION" | "INVITATION" | "MODERATION";
  targetType: "POST" | "COMMENT" | "COMMUNITY";
  targetId: string;
}

/**
 * Crea una notificación dentro de una transacción.
 * Si el destinatario es el mismo remitente, la operación se ignora para evitar notificaciones propias.
 */
export async function createNotificationTx(
  tx: any,
  data: CreateNotificationInput
) {
  // Evitar notificaciones al mismo usuario que causó la acción
  if (data.senderId && data.recipientId === data.senderId) {
    return null;
  }

  const [newNotif] = await tx
    .insert(notifications)
    .values({
      recipientId: data.recipientId,
      senderId: data.senderId,
      type: data.type,
      targetType: data.targetType,
      targetId: data.targetId,
      isRead: false,
    })
    .returning();

  return newNotif;
}

/**
 * Crea una notificación para casos simples sin transacción.
 * Si el destinatario es el mismo remitente, la operación se ignora para evitar notificaciones propias.
 */
export async function createNotification(data: CreateNotificationInput) {
  // Evitar notificaciones al mismo usuario que causó la acción
  if (data.senderId && data.recipientId === data.senderId) {
    return null;
  }

  const [newNotif] = await poolDb
    .insert(notifications)
    .values({
      recipientId: data.recipientId,
      senderId: data.senderId,
      type: data.type,
      targetType: data.targetType,
      targetId: data.targetId,
      isRead: false,
    })
    .returning();

  return newNotif;
}
