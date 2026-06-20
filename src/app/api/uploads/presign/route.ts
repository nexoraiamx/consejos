import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/db";
import { communityMembers, communities } from "@/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { s3Client, validateFile, generateFileKey } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado: Inicia sesión para continuar." },
        { status: 401 }
      );
    }

    // 2. Validar si el usuario está suspendido
    if (user.isSuspended) {
      return NextResponse.json(
        { error: "Acceso denegado: Esta cuenta se encuentra suspendida." },
        { status: 403 }
      );
    }

    // 3. Obtener cuerpo de la petición
    const body = await req.json();
    const { 
      communityId, 
      targetType, 
      targetId, 
      uploadSessionId, 
      fileName, 
      fileSize, 
      mimeType 
    } = body;

    // Validar campos obligatorios
    if (!communityId) {
      return NextResponse.json({ error: "El campo communityId es obligatorio." }, { status: 400 });
    }
    if (targetType !== "POST" && targetType !== "COMMENT") {
      return NextResponse.json({ error: "El campo targetType debe ser POST o COMMENT." }, { status: 400 });
    }
    if (!targetId && !uploadSessionId) {
      return NextResponse.json({ error: "Se requiere targetId o uploadSessionId." }, { status: 400 });
    }
    if (!fileName || !fileSize || !mimeType) {
      return NextResponse.json({ error: "fileName, fileSize y mimeType son obligatorios." }, { status: 400 });
    }

    // 4. Validar existencia de la comunidad
    const community = await db.query.communities.findFirst({
      where: and(
        eq(communities.id, communityId),
        isNull(communities.deletedAt)
      ),
    });
    if (!community) {
      return NextResponse.json({ error: "La comunidad especificada no existe." }, { status: 404 });
    }

    // 5. Validar membresía aprobada o rol GLOBAL_ADMIN
    const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
    if (!isGlobalAdmin) {
      const membership = await db.query.communityMembers.findFirst({
        where: and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, user.id),
          or(
            eq(communityMembers.status, "APPROVED"),
            eq(communityMembers.status, "approved")
          )
        ),
      });

      if (!membership) {
        return NextResponse.json(
          { error: "Acceso denegado: Debes ser miembro aprobado de la comunidad para subir archivos." },
          { status: 403 }
        );
      }
    }

    // 6. Validar archivo (extensión, tipo MIME y límites de tamaño)
    const validation = validateFile(fileName, fileSize, mimeType);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 7. Generar key de archivo segura
    const key = generateFileKey(user.id, communityId, targetType, fileName, targetId, uploadSessionId);

    // 8. Generar presigned PUT URL
    const bucketName = process.env.R2_BUCKET_NAME || "dummy-bucket";
    const publicUrl = process.env.R2_PUBLIC_URL || "https://dummy-public";

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });

    console.log(`[PRESIGN_API] Signed URL creada exitosamente para el archivo: "${fileName}" con key: "${key}"`);

    return NextResponse.json({
      success: true,
      uploadUrl,
      fileUrl: `${publicUrl}/${key}`,
      fileKey: key,
    });

  } catch (error) {
    console.error("Error al generar presigned URL:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar la firma de subida." },
      { status: 500 }
    );
  }
}
