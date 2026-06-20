// Shared DB guard to protect production data from accidental deletion or seeding.
// Imported at the top of test, seed, and cleanup scripts.

// Try to load .env.local if not already loaded
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch (e) {
    // ignore
  }
}

const dbUrl = process.env.DATABASE_URL || "";
const isProductionHost = dbUrl.includes("ep-quiet-moon-ai16ebsw");
const isProductionEnv = 
  process.env.VERCEL === "1" || 
  process.env.VERCEL_ENV === "production" || 
  process.env.NODE_ENV === "production";
const allowDestructive = process.env.ALLOW_DESTRUCTIVE_TESTS === "true";

if (isProductionHost || isProductionEnv || !allowDestructive) {
  console.error("\n====================================================");
  console.error("❌ BLOQUEO DE SEGURIDAD DE BASE DE DATOS ACTIVADO");
  console.error("====================================================");
  
  let maskedUrl = "No definida";
  if (dbUrl) {
    try {
      const match = dbUrl.match(/@([^/]+)\/([^?]+)/);
      maskedUrl = match ? `postgresql://***:***@${match[1]}/${match[2]}` : dbUrl.replace(/:[^:@]+@/, ":***@");
    } catch (e) {
      maskedUrl = "Error al formatear DATABASE_URL";
    }
  }

  console.error(`- DATABASE_URL: ${maskedUrl}`);
  console.error(`- Host Productivo Detectado: ${isProductionHost ? "SÍ" : "NO"}`);
  console.error(`- Entorno de Producción/Vercel: ${isProductionEnv ? "SÍ" : "NO"}`);
  console.error(`- ALLOW_DESTRUCTIVE_TESTS: ${process.env.ALLOW_DESTRUCTIVE_TESTS || "undefined"}`);
  console.error("----------------------------------------------------");
  console.error("ERROR CRÍTICO: Se bloqueó la ejecución de este script.");
  console.error("Para ejecutar scripts de prueba/sembrado/limpieza:");
  console.error("1. Usa una base de datos local o de pruebas que no sea la de producción.");
  console.error("2. Configura ALLOW_DESTRUCTIVE_TESTS=true en tu entorno.");
  console.error("====================================================\n");
  process.exit(1);
}

console.log("🔓 Guardas de seguridad validadas: Base de datos segura para pruebas locales.");
