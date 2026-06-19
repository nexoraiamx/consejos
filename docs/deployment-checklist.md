# Lista de Verificación para Despliegue en Producción (Deployment Checklist)

Este documento contiene los pasos y verificaciones obligatorias que deben realizarse antes de marcar la plataforma "Consejos" como lista para producción definitiva.

---

## 1. Verificación de Despliegue en Vercel
*   [ ] Realizar push a la rama `main` en GitHub.
*   [ ] Verificar que el build automático en Vercel compila con éxito y el despliegue está en estado **Ready** sin errores de TypeScript ni de rutas estáticas.
*   [ ] Confirmar que el dominio principal apunta al despliegue correcto y que el SSL está activo.

---

## 2. Configuración de Variables de Entorno (Vercel)
Asegurar que todas las siguientes variables estén registradas en el panel de Vercel:

### Base de Datos (Neon)
*   [ ] `DATABASE_URL`: Cadena de conexión PostgreSQL de Neon con el pool habilitado (`sslmode=require`).

### Autenticación (Clerk)
*   [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clave pública de Clerk.
*   [ ] `CLERK_SECRET_KEY`: Clave secreta de Clerk.
*   [ ] `CLERK_WEBHOOK_SECRET`: Secreto Svix obtenido del panel de Clerk para validar la autenticidad de las sincronizaciones de usuarios.
*   [ ] `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: `/sign-in`
*   [ ] `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: `/sign-up`
*   [ ] `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`: `/app`
*   [ ] `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`: `/app`

### Almacenamiento (Cloudflare R2)
*   [ ] `R2_ACCOUNT_ID`: ID de cuenta de Cloudflare.
*   [ ] `R2_ACCESS_KEY_ID`: ID de llave de acceso API con permisos Admin Read/Write.
*   [ ] `R2_SECRET_ACCESS_KEY`: Llave de acceso secreta de API.
*   [ ] `R2_BUCKET_NAME`: Nombre exacto del bucket R2.
*   [ ] `R2_PUBLIC_URL`: URL pública (dominio personalizado o subdominio `r2.dev`) para servir los archivos cargados.

---

## 3. Configuración del Webhook de Clerk en Producción
Para garantizar que las altas, modificaciones y bajas de usuarios en Clerk se sincronicen en tiempo real en la base de datos Neon:

1. Ve a la consola de **Clerk > Webhooks**.
2. Haz clic en **Add Endpoint**.
3. En **Endpoint URL**, ingresa la URL de producción de la app apuntando al endpoint de webhook:
   `https://consejos-app.vercel.app/api/webhooks/clerk` (reemplazar con tu dominio real).
4. En **Message Filtering**, selecciona los siguientes eventos:
   * `user.created`
   * `user.updated`
   * `user.deleted`
5. Haz clic en **Create**.
6. Copia el **Signing Secret** (clave `whsec_...`) y agrégala en la variable de entorno `CLERK_WEBHOOK_SECRET` de Vercel.

---

## 4. Configuración de Cloudflare R2 (CORS y Ciclo de Vida)
*   [ ] **CORS**: Asegurar que las URLs de producción de Vercel (`consejos-app.vercel.app`) estén agregadas en la política de CORS de R2 con los métodos `PUT`, `GET` y `HEAD` habilitados.
*   [ ] **Regla de Ciclo de Vida (Housekeeping)**: Crear una regla de ciclo de vida en R2 para eliminar de forma automática los archivos bajo el prefijo `uploads/*/drafts/` después de 7 días, evitando fugas de almacenamiento y sobrecostos.

---

## 5. Pruebas de Humo en Producción (Smoke Tests)
*   [ ] **Acceso sin sesión**: Hacer curl a `https://consejos-app.vercel.app/api/uploads/presign` y verificar que responde estrictamente con un estado **`401 Unauthorized`**.
*   [ ] **Sincronización Clerk-Neon**: Registrar un usuario nuevo y verificar mediante la consola de Neon que se insertó correctamente el registro en las tablas `users` y `profiles`.
*   [ ] **Subida de Archivos**: Crear un post adjuntando una imagen y verificar que se visualiza en el feed principal y detalle del post.
*   [ ] **Reputación automática**: Aceptar la respuesta de un comentario y verificar que el contador de reputación del comentarista se incrementa en `+50` en su avatar.
*   [ ] **Moderación**: Reportar un post y verificar que aparece en el panel de moderación local y global, permitiendo ocultarlo.
