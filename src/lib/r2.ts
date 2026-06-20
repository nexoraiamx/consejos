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
  forcePathStyle: true,
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
  AUDIO: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/mpeg3", "audio/webm"],
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

  // Extract base MIME type (strip parameter codecs etc)
  const baseMimeType = mimeType.split(";")[0].trim().toLowerCase();
  
  // Find extension
  const lastDot = lowercaseName.lastIndexOf(".");
  const extension = lastDot !== -1 ? lowercaseName.substring(lastDot) : "";

  // Categories extension mapping
  const allowedExtensions = {
    IMAGE: [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    VIDEO: [".mp4", ".webm", ".ogg"],
    AUDIO: [".mp3", ".wav", ".m4a", ".mpeg", ".ogg", ".webm"],
    PDF: [".pdf"]
  };

  // Determine file type category based on MIME type first
  let detectedType: "IMAGE" | "VIDEO" | "AUDIO" | "PDF" | null = null;
  if (ALLOWED_MIMES.IMAGE.includes(baseMimeType)) {
    detectedType = "IMAGE";
  } else if (ALLOWED_MIMES.VIDEO.includes(baseMimeType)) {
    detectedType = "VIDEO";
  } else if (ALLOWED_MIMES.AUDIO.includes(baseMimeType)) {
    detectedType = "AUDIO";
  } else if (ALLOWED_MIMES.PDF.includes(baseMimeType)) {
    detectedType = "PDF";
  }

  // Fallback to extension if MIME type is generic or unknown
  if (!detectedType) {
    const extMimeMapping: Record<string, "IMAGE" | "VIDEO" | "AUDIO" | "PDF"> = {
      ".png": "IMAGE", ".jpg": "IMAGE", ".jpeg": "IMAGE", ".gif": "IMAGE", ".webp": "IMAGE",
      ".mp4": "VIDEO", ".webm": "VIDEO", ".ogg": "VIDEO",
      ".mp3": "AUDIO", ".wav": "AUDIO", ".m4a": "AUDIO", ".mpeg": "AUDIO",
      ".pdf": "PDF"
    };
    detectedType = extMimeMapping[extension] || null;
  }

  if (!detectedType) {
    return { valid: false, error: `Tipo de archivo no permitido (${mimeType}).` };
  }

  // Cross-validate extension matches the detected category
  const isExtensionValid = allowedExtensions[detectedType].includes(extension);
  if (!isExtensionValid) {
    return { valid: false, error: `La extensión del archivo (${extension}) no corresponde al tipo de archivo detectado (${detectedType}).` };
  }

  const limit = LIMITS[detectedType];
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
  communityId: string | null,
  targetType: "POST" | "COMMENT" | "COMMUNITY",
  fileName: string,
  targetId?: string,
  uploadSessionId?: string
): string {
  // Sanitize filename to remove slashes or dangerous characters
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const randomUuid = crypto.randomUUID();

  if (targetType === "COMMUNITY") {
    if (communityId) {
      return `uploads/${userId}/communities/${communityId}/${randomUuid}-${sanitizedName}`;
    } else {
      return `uploads/${userId}/communities/new/${randomUuid}-${sanitizedName}`;
    }
  }

  const commId = communityId || "unknown";
  if (targetId) {
    // Existing post/comment
    return `uploads/${userId}/${commId}/${targetType.toLowerCase()}/${targetId}/${randomUuid}-${sanitizedName}`;
  } else {
    // Draft / New post/comment
    const session = uploadSessionId || crypto.randomUUID();
    return `uploads/${userId}/${commId}/drafts/${session}/${randomUuid}-${sanitizedName}`;
  }
}
