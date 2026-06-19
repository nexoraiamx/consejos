# Usuarios Demo de Prueba (Semilla)

Para facilitar la evaluación de control de acceso, flujos de moderación y carga de multimedia, la plataforma cuenta con tres perfiles predefinidos con diferentes niveles de autorización.

---

## 1. Perfiles y Credenciales Demo

> [!WARNING]
> **Creación en Clerk**: Por seguridad, los usuarios de producción y desarrollo local no deben tener llaves hardcodeadas en scripts. Sigue las instrucciones de la sección 3 para crearlos en tu instancia de Clerk y sincronizarlos con Neon DB antes de realizar las pruebas.

| Rol | Email | Rol Global (Neon) | Permisos Clave |
| :--- | :--- | :---: | :--- |
| **Global Admin** | `admin@nexorai.mx` | `GLOBAL_ADMIN` | Acceso a `/app/admin`, suspender/restaurar cualquier usuario, ver logs de auditoría global, moderar reportes de cualquier comunidad. |
| **Community Admin**| `cadmin@nexorai.mx` | `MEMBER` | Administrador de `r/comunidad-demo`, moderar posts y comentarios locales, acceder a `/moderation` de su comunidad. |
| **Member (Miembro)** | `member@nexorai.mx` | `MEMBER` | Crear posts, responder hilos, subir archivos y enlaces en `r/comunidad-demo`, reportar contenidos de terceros, recibir notificaciones. |

---

## 2. Lo que cada Rol debe Probar

### Global Admin (`admin@nexorai.mx`)
*   Entra a la Consola Global en `/app/admin` para revisar el **Historial de Auditoría** completo y los reportes de todas las comunidades.
*   Prueba a suspender temporalmente al usuario `member@nexorai.mx` e intenta escribir contenido con esa cuenta para comprobar la denegación en tiempo de ejecución.
*   Restaura la cuenta del miembro y confirma que vuelve a tener acceso de escritura.

### Community Admin (`cadmin@nexorai.mx`)
*   Entra a `r/comunidad-demo` y navega a **Herramientas de Moderación** en la barra lateral para revisar el reporte pendiente.
*   Oculta una publicación en su comunidad y valida que se muestra un badge "Oculto" a los moderadores, y que desaparece del feed para usuarios comunes.
*   Crea una nueva comunidad y verifica que se le asigna el rol de creador/administrador local de forma automática.

### Member (`member@nexorai.mx`)
*   Publica una nueva duda en `r/comunidad-demo` utilizando el selector de tipos y añade una imagen arrastrándola o un enlace de referencia en la sección de adjuntos.
*   Comenta en publicaciones de otros miembros y responde a comentarios dentro de hilos anidados.
*   Reporta publicaciones o comentarios inapropiados de otros usuarios seleccionando un motivo.
*   Revisa la campana de notificaciones en la barra lateral para marcar alertas como leídas o eliminarlas.

---

## 3. Instrucciones de Creación y Sincronización

Sigue estos pasos para dar de alta estas cuentas en tu entorno:

### Paso 1: Crear los Usuarios en Clerk
1. Ve al panel de control de tu instancia de **Clerk**.
2. Haz clic en **Users** en la barra lateral izquierda.
3. Haz clic en el botón **Add user** en la esquina superior derecha.
4. Crea cada una de las 3 cuentas ingresando los correos electrónicos:
   * `admin@nexorai.mx`
   * `cadmin@nexorai.mx`
   * `member@nexorai.mx`
5. Asígnale una contraseña temporal segura a cada uno (recomienda rotarla al primer inicio de sesión).

### Paso 2: Sincronizar con Neon DB
Al crear los usuarios en Clerk, si tienes configurado el webhook de Clerk apuntando a tu servidor local (o en producción), los usuarios se sincronizarán e insertarán automáticamente en la base de datos Neon con el rol por defecto (`MEMBER`).

Si estás probando en desarrollo local y no tienes los webhooks activados en Clerk, puedes iniciar sesión por primera vez con cada una de las cuentas en tu navegador (`http://localhost:3000`). Al iniciar sesión, Clerk creará el registro y el middleware de Next.js se encargará de sincronizar los perfiles.

### Paso 3: Ejecutar el Script de Sembrado (Seed)
Una vez que las cuentas existan en Clerk y en tu tabla `users` de Neon DB, ejecuta el siguiente comando en tu terminal para configurar los roles de base de datos (`GLOBAL_ADMIN`, membresías de comunidad, posts demo y reputaciones):

```bash
npm run db:seed
```

Esto actualizará los roles globales y generará automáticamente la comunidad demo (`r/comunidad-demo`), posts con adjuntos y comentarios para que puedas comenzar a probar de inmediato.
