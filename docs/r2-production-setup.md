# Configuración de Producción - Cloudflare R2 y Almacenamiento Multimedia

Esta guía detalla los pasos técnicos y configuraciones requeridas para poner en marcha el almacenamiento multimedia en producción utilizando Cloudflare R2, la base de datos Neon y Vercel.

---

## 1. Variables de Entorno Necesarias (Vercel / Local)

Estas son las variables exactas que debes configurar en el entorno de desarrollo local (`.env.local`) y en el panel de **Vercel** bajo **Project Settings > Environment Variables**:

```env
# Cloudflare R2 Storage Config
R2_ACCOUNT_ID="tu-id-de-cuenta-cloudflare"
R2_ACCESS_KEY_ID="tu-key-id-de-api-r2"
R2_SECRET_ACCESS_KEY="tu-secret-access-key-de-api-r2"
R2_BUCKET_NAME="tu-nombre-de-bucket-r2"
R2_PUBLIC_URL="https://pub-tu-id-de-bucket.r2.dev"
```

---

## 2. Guía de Creación del Bucket R2 en Cloudflare

1. Inicia sesión en tu consola de administración de **Cloudflare**.
2. En la barra lateral izquierda, selecciona **R2**.
3. Haz clic en **Create bucket**.
4. Escribe un nombre único para el bucket (este valor será asignado a `R2_BUCKET_NAME`).
5. Mantén la ubicación en **Automatic** y haz clic en el botón **Create bucket**.

---

## 3. Generación de las Credenciales (R2 API Token)

Para permitir que nuestro servidor de Next.js firme las subidas y se comunique con el bucket, necesitamos generar llaves de API:

1. Desde el panel principal de **R2**, haz clic en el enlace **Manage R2 API Tokens** en el costado derecho.
2. Haz clic en el botón **Create API token**.
3. Nombra tu token de forma descriptiva (ej. `consejos-app-prod`).
4. En **Permissions**, selecciona **Admin Read & Write** (esto permite leer los metadatos y firmar solicitudes `PUT`).
5. En la sección **Clearance**, define el tiempo de expiración del token (se recomienda mantenerlo activo indefinidamente o rotarlo periódicamente).
6. Haz clic en **Create API Token**.
7. Copia y guarda de inmediato los valores proporcionados (Cloudflare no volverá a mostrarlos):
   * **Access Key ID** &rarr; Asignar a `R2_ACCESS_KEY_ID`.
   * **Secret Access Key** &rarr; Asignar a `R2_SECRET_ACCESS_KEY`.
   * **Endpoint**: Copia el ID de cuenta que viene embebido en la URL del endpoint (es la cadena alfanumérica entre `https://` y `.r2.cloudflarestorage.com`) y asígnalo a `R2_ACCOUNT_ID`.

---

## 4. Configuración de Acceso Público y Obtención de `R2_PUBLIC_URL`

Por defecto, los buckets de Cloudflare R2 son totalmente privados. Debes habilitar la visualización para que los navegadores puedan leer las imágenes, audios o videos publicados:

1. Ve a la pestaña **Settings** de tu bucket.
2. Desplázate hacia abajo hasta la sección **Public Access**.
3. En **R2.dev subdomain**, haz clic en **Allow** y escribe "allow" para confirmar el acceso público.
4. Copia el subdominio gratuito autogenerado (ej. `https://pub-a1b2c3d4.r2.dev`) y asígnalo a `R2_PUBLIC_URL`.
5. *(Opcional)* Si cuentas con un dominio propio, puedes hacer clic en **Connect Domain** para asociarlo (ej. `https://media.nexorai.mx`).

---

## 5. Configuración de Políticas de CORS en Cloudflare R2

Para evitar bloqueos por políticas de origen cruzado (CORS) cuando el navegador del usuario intente subir archivos directamente al bucket mediante llamadas HTTP `PUT` directas, debes agregar la siguiente configuración CORS en Cloudflare (es crucial incluir la solicitud de preflight `OPTIONS` y habilitar los dominios correspondientes):

1. Entra a la configuración del bucket en Cloudflare.
2. Ve a la pestaña **Settings** y busca la sección **CORS Policy**.
3. Haz clic en **Add CORS policy** y pega el siguiente JSON:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD", "OPTIONS"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

> [!TIP]
> Al configurar `"AllowedOrigins": ["*"]` se evitan problemas de CORS con las URLs autogeneradas por Vercel para ramas de vista previa (Preview deployments). En producción real y por seguridad, una vez estabilizado, puedes restringir la lista a tu dominio principal de producción (ej: `https://tu-dominio.com`) y `http://localhost:3000`.

---

## 6. Housekeeping y Gestión de Archivos Huérfanos

### El Riesgo
Cuando un usuario arrastra un archivo al formulario, la aplicación solicita un enlace firmado a la API, realiza la subida directa a Cloudflare R2, pero si el usuario cierra el navegador o cancela la operación antes de presionar "Publicar" o "Comentar", el archivo físico permanecerá guardado en el storage para siempre sin estar asociado a ninguna publicación o comentario (archivo huérfano), incurriendo en costos innecesarios de almacenamiento a largo plazo.

### Mitigación y Reglas de Ciclo de Vida (Lifecycle Rules)
Para evitar fugas de almacenamiento y costos desmedidos, se debe configurar una regla de ciclo de vida nativa directamente en Cloudflare R2 para purgar los borradores expirados de forma periódica:

1. En la pestaña **Settings** del bucket, busca la sección **Object Lifecycle Rules**.
2. Haz clic en **Add rule**.
3. Configura la regla con los siguientes datos:
   * **Rule name**: `Purge Draft Uploads`
   * **Rule action**: **Delete objects**
   * **Target prefix**: `uploads/` (o más específicamente `uploads/*/drafts/` para no afectar imágenes de perfil definitivas).
   * **Age**: **7 days** (eliminar objetos que lleven más de 7 días guardados en la carpeta de drafts).
4. Haz clic en **Create rule**.

> [!IMPORTANT]
> Esta regla de ciclo de vida se ejecuta de forma asíncrona a nivel de la infraestructura de Cloudflare, garantizando que todo archivo subido que no se consolide en una publicación de Neon DB (los cuales al guardarse se mueven a rutas sin el prefijo `/drafts/`) se elimine a los 7 días automáticamente sin costo computacional alguno para el servidor de Next.js o base de datos.

---

## 7. Validación del Funcionamiento en Producción

### Paso 1: Carga desde la UI
1. Inicia sesión en la plataforma.
2. Ve a cualquier comunidad activa y haz clic en **Publicar**.
3. Arrastra una imagen o PDF al área de uploader.
4. Verás una barra de progreso que se llena al 100% y un distintivo verde "Listo para publicar". Esto confirma que la llamada CORS y la firma de API `/api/uploads/presign` se completaron con éxito.

### Paso 2: Validación en Neon DB
Una vez guardado el post, puedes comprobar que la base de datos almacena correctamente los metadatos y enlaces de forma transaccional corriendo el siguiente query SQL en tu consola de base de datos Neon:

```sql
SELECT id, uploader_id, file_name, file_url, file_key, mime_type, created_at
FROM attachments
WHERE target_type = 'POST';
```

Debe retornar un listado con las rutas R2 físicas asociadas al post recién creado.
