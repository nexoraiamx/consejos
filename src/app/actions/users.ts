"use server";

import { getCurrentUser } from "@/lib/auth-helpers";

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
