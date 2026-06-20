import { pgTable, varchar, timestamp, text, boolean, uuid, integer, jsonb, unique, index, PgColumn } from "drizzle-orm/pg-core";

// 1. USERS TABLE (Syncs with Clerk Auth)
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 256 }).primaryKey(), // Clerk User ID (user_...)
    email: varchar("email", { length: 256 }).notNull().unique(),
    globalRole: varchar("global_role", { length: 50 }).default("MEMBER").notNull(), // 'GLOBAL_ADMIN', 'MEMBER'
    isSuspended: boolean("is_suspended").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    emailIdx: index("email_idx").on(table.email),
    deletedAtIdx: index("user_deleted_at_idx").on(table.deletedAt),
  })
);

// 2. PROFILES TABLE (User public metadata & Experts)
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .unique()
      .notNull(),
    displayName: varchar("display_name", { length: 256 }).notNull(),
    username: varchar("username", { length: 256 }).unique().notNull(),
    avatarUrl: varchar("avatar_url", { length: 512 }),
    bio: text("bio"),
    website: varchar("website", { length: 256 }),
    twitterUrl: varchar("twitter_url", { length: 256 }),
    githubUrl: varchar("github_url", { length: 256 }),
    isExpert: boolean("is_expert").default(false).notNull(), // Expert System Flag
    expertise: jsonb("expertise").$type<string[]>().default([]).notNull(), // Expert Tags
    verifiedAt: timestamp("verified_at"), // Verification Timestamp
    socialLinks: jsonb("social_links").$type<Record<string, string>>().default({}).notNull(),
    interests: jsonb("interests").$type<string[]>().default([]).notNull(),
    skillLevel: varchar("skill_level", { length: 50 }),
    onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
    discoveryGoals: jsonb("discovery_goals").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    usernameIdx: index("username_idx").on(table.username),
  })
);

// 3. COMMUNITIES TABLE
export const communities = pgTable(
  "communities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).unique().notNull(), // e.g. "nextjs"
    displayName: varchar("display_name", { length: 100 }).notNull(),
    description: text("description"),
    logoUrl: varchar("logo_url", { length: 512 }),
    avatarUrl: varchar("avatar_url", { length: 512 }),
    bannerUrl: varchar("banner_url", { length: 512 }),
    privacyType: varchar("privacy_type", { length: 50 }).default("PUBLIC").notNull(), // 'PUBLIC', 'PRIVATE', 'INVITE_ONLY'
    category: varchar("category", { length: 256 }),
    creatorId: varchar("creator_id", { length: 256 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    slugIdx: index("slug_idx").on(table.slug),
    commDeletedAtIdx: index("comm_deleted_at_idx").on(table.deletedAt),
  })
);

// 4. COMMUNITY MEMBERS TABLE
export const communityMembers = pgTable(
  "community_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 50 }).default("MEMBER").notNull(), // 'COMMUNITY_ADMIN', 'MODERATOR', 'MEMBER'
    status: varchar("status", { length: 50 }).default("APPROVED").notNull(), // 'PENDING', 'APPROVED', 'BANNED'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    commMemberUnique: unique("community_user_unique").on(table.communityId, table.userId),
    memberCommunityIdx: index("member_community_idx").on(table.communityId),
    memberUserIdx: index("member_user_idx").on(table.userId),
  })
);

// 5. POSTS TABLE
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    authorId: varchar("author_id", { length: 256 })
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    content: text("content").notNull(),
    postType: varchar("post_type", { length: 50 }).default("DISCUSSION").notNull(), // 'QUESTION', 'RESOURCE', 'DISCUSSION', 'CASE_STUDY'
    category: varchar("category", { length: 100 }),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    status: varchar("status", { length: 50 }).default("ACTIVE").notNull(), // 'ACTIVE', 'HIDDEN', 'DELETED'
    acceptedAnswerId: uuid("accepted_answer_id").references((): PgColumn => comments.id, { onDelete: "set null" }), // Accepted Answer Support
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    postCommunityIdx: index("post_community_idx").on(table.communityId),
    postAuthorIdx: index("post_author_idx").on(table.authorId),
    postStatusIdx: index("post_status_idx").on(table.status),
    postDeletedAtIdx: index("post_deleted_at_idx").on(table.deletedAt),
  })
);

// 6. COMMENTS TABLE
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    parentId: uuid("parent_id").references((): PgColumn => comments.id, { onDelete: "cascade" }), // Self-reference for replies
    authorId: varchar("author_id", { length: 256 })
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    content: text("content").notNull(),
    status: varchar("status", { length: 50 }).default("ACTIVE").notNull(), // 'ACTIVE', 'HIDDEN', 'DELETED'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    commentPostIdx: index("comment_post_idx").on(table.postId),
    commentParentIdx: index("comment_parent_idx").on(table.parentId),
    commentDeletedAtIdx: index("comment_deleted_at_idx").on(table.deletedAt),
  })
);

// 7. REACTIONS TABLE
export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(), // 'POST', 'COMMENT'
    targetId: uuid("target_id").notNull(),
    reactionType: varchar("reaction_type", { length: 50 }).notNull(), // 'UPVOTE', 'DOWNVOTE', 'FAVORITE', 'SAVE'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userTargetReactionUnique: unique("user_target_reaction_unique").on(
      table.userId,
      table.targetType,
      table.targetId,
      table.reactionType
    ),
    reactionTargetIdx: index("reaction_target_idx").on(table.targetType, table.targetId),
  })
);

// 8. ATTACHMENTS TABLE
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploaderId: varchar("uploader_id", { length: 256 })
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(), // 'POST', 'COMMENT', 'AVATAR', 'COMMUNITY_ASSET'
    targetId: uuid("target_id"), // ID of post or comment, nullable until linked
    fileUrl: varchar("file_url", { length: 512 }).notNull(),
    fileKey: varchar("file_key", { length: 512 }).notNull(), // Cloudflare R2 key
    fileName: varchar("file_name", { length: 256 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    attachmentTargetIdx: index("attachment_target_idx").on(table.targetType, table.targetId),
  })
);

// 9. REPORTS TABLE
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: varchar("reporter_id", { length: 256 })
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(), // 'POST', 'COMMENT'
    targetId: uuid("target_id").notNull(),
    reason: varchar("reason", { length: 100 }).notNull(), // 'Spam', 'Abuse', etc.
    description: text("description"),
    status: varchar("status", { length: 50 }).default("PENDING").notNull(), // 'PENDING', 'RESOLVED', 'DISMISSED'
    moderatorId: varchar("moderator_id", { length: 256 }).references(() => users.id, { onDelete: "set null" }),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    reportStatusIdx: index("report_status_idx").on(table.status),
    reportTargetIdx: index("report_target_idx").on(table.targetType, table.targetId),
  })
);

// 10. NOTIFICATIONS TABLE
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: varchar("recipient_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    senderId: varchar("sender_id", { length: 256 }).references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(), // 'COMMENT', 'MENTION', 'REACTION', 'INVITATION', 'MODERATION'
    targetType: varchar("target_type", { length: 50 }).notNull(), // 'POST', 'COMMENT', 'COMMUNITY'
    targetId: uuid("target_id").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    notificationRecipientIdx: index("notification_recipient_idx").on(table.recipientId),
    notificationIsReadIdx: index("notification_is_read_idx").on(table.isRead),
  })
);

// 11. AUDIT LOGS TABLE
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: varchar("actor_id", { length: 256 }).references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(), // 'USER_SUSPEND', 'POST_HIDE', 'ROLE_CHANGE', etc.
    targetType: varchar("target_type", { length: 55 }).notNull(),
    targetId: varchar("target_id", { length: 256 }).notNull(),
    description: text("description").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    auditActorIdx: index("audit_actor_idx").on(table.actorId),
    auditActionIdx: index("audit_action_idx").on(table.action),
  })
);

// 12. REPUTATION EVENTS TABLE
export const reputationEvents = pgTable(
  "reputation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(), // 'POST_UPVOTED', 'COMMENT_UPVOTED', etc.
    points: integer("points").notNull(),
    sourceType: varchar("source_type", { length: 50 }), // 'POST', 'COMMENT', 'SYSTEM'
    sourceId: uuid("source_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    reputationUserIdx: index("reputation_event_user_idx").on(table.userId),
  })
);

// 13. USER REPUTATION TABLE (Cache)
export const userReputation = pgTable(
  "user_reputation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .unique()
      .notNull(),
    score: integer("score").default(0).notNull(),
    level: integer("level").default(1).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userRepScoreIdx: index("user_rep_score_idx").on(table.score),
  })
);

// 14. BOOKMARKS TABLE (Generic for multiple targets)
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(), // 'POST', 'RESOURCE', 'COMMENT', etc.
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userTargetBookmarkUnique: unique("user_target_bookmark_unique").on(table.userId, table.targetType, table.targetId),
    bookmarkUserIdx: index("bookmark_user_idx").on(table.userId),
    bookmarkTargetIdx: index("bookmark_target_idx").on(table.targetType, table.targetId),
  })
);

// 15. INVITATIONS TABLE
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    code: varchar("code", { length: 100 }).unique().notNull(),
    creatorId: varchar("creator_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    usesCount: integer("uses_count").default(0).notNull(),
    maxUses: integer("max_uses"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    inviteCodeIdx: index("invite_code_idx").on(table.code),
    inviteCommunityIdx: index("invite_community_idx").on(table.communityId),
  })
);

// 16. JOIN REQUESTS TABLE
export const joinRequests = pgTable(
  "join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 50 }).default("PENDING").notNull(), // 'PENDING', 'APPROVED', 'REJECTED'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    joinReqUnique: unique("join_req_user_community_unique").on(table.communityId, table.userId),
    joinReqCommunityIdx: index("join_req_community_idx").on(table.communityId),
    joinReqUserIdx: index("join_req_user_idx").on(table.userId),
  })
);


// 17. COMMUNITY SLUG REDIRECTS TABLE
export const communitySlugRedirects = pgTable(
  "community_slug_redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    oldSlug: varchar("old_slug", { length: 100 }).unique().notNull(),
    newSlug: varchar("new_slug", { length: 100 }).notNull(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    oldSlugIdx: index("old_slug_idx").on(table.oldSlug),
  })
);

// 18. USER BADGES TABLE
export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 256 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    badgeCode: varchar("badge_code", { length: 100 }).notNull(),
    badgeName: varchar("badge_name", { length: 256 }).notNull(),
    badgeIcon: varchar("badge_icon", { length: 100 }).notNull(),
    awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  },
  (table) => ({
    userBadgeUnique: unique("user_badge_unique").on(table.userId, table.badgeCode),
    badgeUserIdx: index("badge_user_idx").on(table.userId),
  })
);


