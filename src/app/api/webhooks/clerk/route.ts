import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, profiles, userReputation } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// Clerk Webhook Interface
interface ClerkUserPayload {
  id: string;
  email_addresses: Array<{
    id: string;
    email_address: string;
  }>;
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  username: string | null;
}

// Function to generate a unique username
async function generateUniqueUsername(
  baseInput: string | null,
  email: string
): Promise<string> {
  // 1. Clean input or fallback to email prefix
  let base = baseInput
    ? baseInput.toLowerCase().replace(/[^a-z0-9]/g, "")
    : email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!base || base.length < 2) {
    base = "user";
  }

  let username = base;
  let isUnique = false;
  let counter = 0;

  // 2. Loop to check DB uniqueness
  while (!isUnique) {
    const existing = await db
      .select({ username: profiles.username })
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);

    if (existing.length === 0) {
      isUnique = true;
    } else {
      counter++;
      // Append incremental numbers or suffix
      username = `${base}${counter}`;
    }
  }

  return username;
}

export async function POST(req: Request) {
  // Get the webhook secret
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not configured");
    return new Response("Error: CLERK_WEBHOOK_SECRET must be configured", {
      status: 500,
    });
  }

  // Get the headers for Svix verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with the secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error: Invalid signature", {
      status: 400,
    });
  }

  // Extract event type and data
  const eventType = evt.type;
  const eventData = evt.data as any;

  console.log(`Received Clerk Webhook of type: ${eventType}`);

  try {
    if (eventType === "user.created") {
      const data = eventData as ClerkUserPayload;

      // Extract primary email
      const primaryEmailObj = data.email_addresses.find(
        (email) => email.id === data.primary_email_address_id
      );
      const email = primaryEmailObj ? primaryEmailObj.email_address : "";

      if (!email) {
        return new Response("Error: User email is required", { status: 400 });
      }

      // Generate unique username
      const username = await generateUniqueUsername(data.username, email);

      // Concatenate display name
      let displayName = "";
      if (data.first_name || data.last_name) {
        displayName = [data.first_name, data.last_name].filter(Boolean).join(" ");
      } else {
        displayName = email.split("@")[0];
      }

      // Run transactional insert for user + profile + reputation
      await db.transaction(async (tx) => {
        // 1. Insert user
        await tx.insert(users).values({
          id: data.id,
          email: email,
          globalRole: "MEMBER",
          isSuspended: false,
        });

        // 2. Insert profile
        await tx.insert(profiles).values({
          userId: data.id,
          displayName,
          username,
          avatarUrl: data.image_url,
          isExpert: false,
          expertise: [],
        });

        // 3. Insert reputation initial cache
        await tx.insert(userReputation).values({
          userId: data.id,
          score: 0,
          level: 1,
        });
      });

      console.log(`Successfully created user, profile, and reputation for ${data.id}`);
      return new Response("User created successfully", { status: 201 });
    }

    if (eventType === "user.updated") {
      const data = eventData as ClerkUserPayload;

      // Extract primary email
      const primaryEmailObj = data.email_addresses.find(
        (email) => email.id === data.primary_email_address_id
      );
      const email = primaryEmailObj ? primaryEmailObj.email_address : "";

      if (!email) {
        return new Response("Error: User email is required", { status: 400 });
      }

      // Concatenate display name
      let displayName = "";
      if (data.first_name || data.last_name) {
        displayName = [data.first_name, data.last_name].filter(Boolean).join(" ");
      } else {
        displayName = email.split("@")[0];
      }

      // Run transactional update
      await db.transaction(async (tx) => {
        // 1. Update user
        await tx
          .update(users)
          .set({
            email: email,
            updatedAt: new Date(),
          })
          .where(eq(users.id, data.id));

        // 2. Update profile (Display Name & Avatar)
        await tx
          .update(profiles)
          .set({
            displayName,
            avatarUrl: data.image_url,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, data.id));
      });

      console.log(`Successfully updated user and profile for ${data.id}`);
      return new Response("User updated successfully", { status: 200 });
    }

    if (eventType === "user.deleted") {
      const data = eventData as { id: string };

      // Apply soft delete on user only (preserving communities/posts/comments history)
      await db
        .update(users)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, data.id));

      console.log(`Successfully applied soft delete for user ${data.id}`);
      return new Response("User deleted successfully", { status: 200 });
    }

    return new Response("Webhook event ignored", { status: 200 });
  } catch (dbError) {
    console.error("Database operation failed in Clerk webhook:", dbError);
    return new Response("Internal server error", { status: 500 });
  }
}
