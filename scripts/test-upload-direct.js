const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const bucketName = process.env.R2_BUCKET_NAME || "consejos-media";
const publicUrl = process.env.R2_PUBLIC_URL || "https://pub-73e3aa4562504299b3f05fcf9b38cb1b.r2.dev";

async function testUpload() {
  console.log("====================================================");
  console.log("Iniciando prueba de subida directa a Cloudflare R2...");
  console.log("====================================================");

  const key = `test/debug-${Date.now()}.jpg`;
  const mimeType = "image/jpeg";
  
  // Dummy tiny JPG header bytes to create a valid JPG file structure
  const dummyContent = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 
    0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43
  ]);

  try {
    console.log(`1. Probando ListBuckets para ver los buckets del Token...`);
    const { ListBucketsCommand } = require("@aws-sdk/client-s3");
    const listCommand = new ListBucketsCommand({});
    const bucketsData = await s3Client.send(listCommand);
    console.log("✅ ListBuckets funcionó con éxito! Buckets encontrados:");
    console.log(bucketsData.Buckets);
  } catch (listError) {
    console.warn("⚠️ ListBuckets falló (esto es normal si el token está acotado a un solo bucket):", listError.message);
  }

  try {
    console.log(`\n2. Probando PutObject directo mediante S3Client (backend)...`);
    const directCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: `test/direct-${Date.now()}.jpg`,
      Body: dummyContent,
      ContentType: mimeType,
    });
    
    await s3Client.send(directCommand);
    console.log("✅ ¡PutObject directo mediante S3Client funcionó con éxito! (Las credenciales tienen permiso de escritura)");

    console.log(`\n3. Generando presigned URL para key: "${key}"...`);
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });
    console.log("✅ URL firmada generada con éxito!");
    console.log(`   -> URL: ${uploadUrl}`);

    console.log(`\n3. Realizando petición PUT a la URL firmada...`);
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: dummyContent,
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log(`✅ ¡Archivo subido exitosamente a Cloudflare R2 usando URL firmada!`);
      const fileAccessUrl = `${publicUrl}/${key}`;
      console.log(`\n4. Verificando acceso público al archivo en:`);
      console.log(`   -> ${fileAccessUrl}`);

      console.log("Esperando 2 segundos para propagación en la red de Cloudflare...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      const checkRes = await fetch(fileAccessUrl, { method: "HEAD" });
      console.log(`HEAD Response: ${checkRes.status} ${checkRes.statusText}`);
      if (checkRes.status === 200) {
        console.log(`\n🎉 ¡ÉXITO TOTAL! El archivo se subió a R2 y es accesible públicamente.`);
      } else {
        console.log(`\n⚠️ Advertencia: El archivo subió pero el acceso público retornó estado: ${checkRes.status}`);
      }
    } else {
      const text = await response.text();
      console.error(`❌ Falló la subida con URL firmada. Detalle del error de R2:`, text);
    }
  } catch (error) {
    console.error("❌ Error durante la prueba de subida:", error);
  }
}

testUpload();
