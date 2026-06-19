import { S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID || "dummy-account-id";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "dummy-key-id";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "dummy-secret";

export const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// File size limits in bytes
export const LIMITS = {
  IMAGE: 10 * 1024 * 1024,      // 10MB
  AUDIO: 50 * 1024 * 1024,      // 50MB
  VIDEO: 100 * 1024 * 1024,    // 100MB
  PDF: 25 * 1024 * 1024,       // 25MB
};

// MIME Types Allowlist
export const ALLOWED_MIMES = {
  IMAGE: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  VIDEO: ["video/mp4", "video/webm", "video/ogg"],
  AUDIO: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/mpeg3"],
  PDF: ["application/pdf"],
};

// Dangerous extensions blocklist
export const BLOCKED_EXTENSIONS = [
  ".exe", ".sh", ".bat", ".js", ".ts", ".jsx", ".tsx", ".cmd", ".vbs", 
  ".scr", ".jar", ".msi", ".com", ".gadget", ".wsf", ".pif", ".cpl"
];

/**
 * Validates a file against allowed MIMEs, size limits and blocked extensions.
 */
export function validateFile(fileName: string, fileSize: number, mimeType: string) {
  const lowercaseName = fileName.toLowerCase();
  
  // Check extensions
  const hasDangerousExtension = BLOCKED_EXTENSIONS.some(ext => lowercaseName.endsWith(ext));
  if (hasDangerousExtension) {
    return { valid: false, error: "Archivo peligroso detectado: Extensión bloqueada." };
  }

  // Identify type and validate sizes
  let isAllowed = false;
  let limit = 0;

  if (ALLOWED_MIMES.IMAGE.includes(mimeType)) {
    isAllowed = true;
    limit = LIMITS.IMAGE;
  } else if (ALLOWED_MIMES.VIDEO.includes(mimeType)) {
    isAllowed = true;
    limit = LIMITS.VIDEO;
  } else if (ALLOWED_MIMES.AUDIO.includes(mimeType)) {
    isAllowed = true;
    limit = LIMITS.AUDIO;
  } else if (ALLOWED_MIMES.PDF.includes(mimeType)) {
    isAllowed = true;
    limit = LIMITS.PDF;
  }

  if (!isAllowed) {
    return { valid: false, error: `Tipo de archivo no permitido (${mimeType}).` };
  }

  if (fileSize > limit) {
    const limitMb = Math.round(limit / (1024 * 1024));
    return { valid: false, error: `El archivo excede el tamaño máximo de ${limitMb}MB para este tipo.` };
  }

  return { valid: true };
}

/**
 * Generates a secure R2 key (path) based on user, community, target type and draft session.
 */
export function generateFileKey(
  userId: string,
  communityId: string,
  targetType: "POST" | "COMMENT",
  fileName: string,
  targetId?: string,
  uploadSessionId?: string
): string {
  // Sanitize filename to remove slashes or dangerous characters
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const randomUuid = crypto.randomUUID();

  if (targetId) {
    // Existing post/comment
    return `uploads/${userId}/${communityId}/${targetType.toLowerCase()}/${targetId}/${randomUuid}-${sanitizedName}`;
  } else {
    // Draft / New post/comment
    const session = uploadSessionId || crypto.randomUUID();
    return `uploads/${userId}/${communityId}/drafts/${session}/${randomUuid}-${sanitizedName}`;
  }
}
