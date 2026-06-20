import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

async function configureCors() {
  console.log("====================================================");
  console.log("Configurando CORS para el bucket Cloudflare R2...");
  console.log("====================================================");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error("Faltan variables de entorno para R2:");
    console.error(` - R2_ACCOUNT_ID: ${accountId ? "Configurado" : "Falta"}`);
    console.error(` - R2_ACCESS_KEY_ID: ${accessKeyId ? "Configurado" : "Falta"}`);
    console.error(` - R2_SECRET_ACCESS_KEY: ${secretAccessKey ? "Configurado" : "Falta"}`);
    console.error(` - R2_BUCKET_NAME: ${bucketName ? "Configurado" : "Falta"}`);
    process.exit(1);
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const corsRules = [
    {
      AllowedOrigins: [
        "https://consejos-app.vercel.app",
        "https://*.vercel.app",
        "http://localhost:3000",
      ],
      AllowedMethods: ["GET", "PUT", "POST", "HEAD", "OPTIONS"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag", "Content-Length"],
      MaxAgeSeconds: 86400,
    },
  ];

  try {
    console.log(`Aplicando reglas CORS al bucket: "${bucketName}"...`);
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: corsRules,
      },
    });

    await s3.send(command);
    console.log("✅ ¡Configuración CORS aplicada con éxito en Cloudflare R2!");
    console.log("Reglas configuradas:");
    console.log(JSON.stringify(corsRules, null, 2));
  } catch (error) {
    console.error("❌ Error al aplicar CORS en Cloudflare R2:", error);
  } finally {
    process.exit(0);
  }
}

configureCors();
