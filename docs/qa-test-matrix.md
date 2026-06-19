# Matriz de Pruebas de QA (Aseguramiento de Calidad)

Este documento detalla la matriz de pruebas y los casos de uso específicos que deben ejecutarse para verificar el correcto funcionamiento de la plataforma "Consejos" según los diferentes roles de usuario.

---

## 1. Matriz de Roles vs. Permisos

| Característica / Acción | Guest (Invitado) | Member (Miembro) | Community Admin (Admin Local) | Global Admin (Admin General) |
| :--- | :---: | :---: | :---: | :---: |
| Explorar comunidades públicas | Sí | Sí | Sí | Sí |
| Solicitar unirse a comunidad | No | Sí | Sí (Admin de las suyas) | Sí (Acceso total) |
| Crear publicación (Post) | No | Sí (Miembro Aprobado) | Sí | Sí |
| Comentar en publicaciones | No | Sí (Miembro Aprobado) | Sí | Sí |
| Responder comentarios | No | Sí (Miembro Aprobado) | Sí | Sí |
| Marcar respuesta aceptada | No | Sí (Solo si es autor post) | Sí (Solo si es autor post) | Sí (Solo si es autor post) |
| Subir archivos / R2 / Enlaces | No | Sí (Miembro Aprobado) | Sí | Sí |
| Reportar contenido inapropiado | No | Sí | Sí | Sí |
| Recibir notificaciones en app | No | Sí | Sí | Sí |
| Ocultar/Restaurar posts (Mod) | No | No | Sí (Solo su comunidad) | Sí (Cualquier comunidad) |
| Ocultar/Restaurar comentarios (Mod)| No | No | Sí (Solo su comunidad) | Sí (Cualquier comunidad) |
| Acceso a Panel de Moderación Local | No | No | Sí (Solo su comunidad) | Sí (Cualquier comunidad) |
| Acceso a Consola Global (`/app/admin`) | No | No | No | Sí |
| Suspender / Restaurar cuentas | No | No | No | Sí |
| Consultar logs de auditoría global | No | No | No | Sí |

---

## 2. Casos de Prueba Detallados por Rol

### ROL: Global Admin (`admin@nexorai.mx`)
*   **Caso GA-01: Acceso a Consola de Administración**
    *   *Procedimiento*: Iniciar sesión y navegar a `/app/admin`.
    *   *Resultado esperado*: Se visualiza correctamente el panel con tres pestañas: "Reportes Globales", "Suspender Usuarios" e "Historial de Auditoría".
*   **Caso GA-02: Verificación de Reportes Globales**
    *   *Procedimiento*: En `/app/admin`, entrar a "Reportes Globales".
    *   *Resultado esperado*: Se listan todos los reportes de la plataforma (incluyendo el reporte demo pendiente).
*   **Caso GA-03: Suspender y Restaurar Usuario**
    *   *Procedimiento*:
        1. Ir a "Suspender Usuarios", ingresar el ID o email `member@nexorai.mx` y un motivo, y hacer clic en **Suspender**.
        2. Iniciar sesión como `member@nexorai.mx` e intentar crear un post. Se debe recibir el error `Acceso denegado: Esta cuenta se encuentra suspendida`.
        3. Regresar como Admin, ir a "Suspender Usuarios" y hacer clic en **Restaurar** para `member@nexorai.mx`.
    *   *Resultado esperado*: El usuario es suspendido y restaurado de forma atómica en Neon DB, bloqueando y restaurando sus capacidades de escritura respectivamente.
*   **Caso GA-04: Consulta de Logs de Auditoría**
    *   *Procedimiento*: En `/app/admin`, ir a "Historial de Auditoría".
    *   *Resultado esperado*: Se lista detalladamente el log cronológico de todas las acciones críticas (incluyendo `SYSTEM_SEED`, `POST_CREATE`, suspensiones, etc.).

### ROL: Community Admin (`cadmin@nexorai.mx`)
*   **Caso CA-01: Creación de Comunidad**
    *   *Procedimiento*: Ir a `/app/communities/new`, rellenar nombre, slug, descripción y elegir `PUBLIC` o `PRIVATE`.
    *   *Resultado esperado*: La comunidad se crea, redirige a la nueva comunidad y registra al creador como `COMMUNITY_ADMIN` automáticamente.
*   **Caso CA-02: Acceso a Moderación Local**
    *   *Procedimiento*: Navegar a `/app/r/comunidad-demo` y hacer clic en "Herramientas de Moderación" en la barra lateral.
    *   *Resultado esperado*: Carga el panel local de reportes filtrado para esa comunidad.
*   **Caso CA-03: Ocultar y Restaurar Posts/Comentarios**
    *   *Procedimiento*:
        1. En un post de su comunidad, hacer clic en los tres puntos y seleccionar **Ocultar**. El post debe cambiar su distintivo a "Oculto".
        2. Hacer clic en los tres puntos y hacer clic en **Mostrar**. El post vuelve a estar "Activo".
    *   *Resultado esperado*: Los cambios de estado de visibilidad se procesan de forma atómica y escriben el log correspondiente en `audit_logs`.

### ROL: Member (`member@nexorai.mx`)
*   **Caso MB-01: Unirse a Comunidad Pública**
    *   *Procedimiento*: Entrar a `/app/explore`, buscar una comunidad pública y hacer clic en **Unirse**.
    *   *Resultado esperado*: El estatus de membresía pasa instantáneamente a `APPROVED` y permite interactuar.
*   **Caso MB-02: Crear Publicación con Adjuntos**
    *   *Procedimiento*: Entrar a la comunidad, hacer clic en **Publicar**, redactar contenido, arrastrar una imagen o PDF al uploader, agregar un enlace externo y guardar.
    *   *Resultado esperado*: El post se crea, los archivos se asocian en la tabla `attachments` de Neon y se renderizan correctamente con la previsualización integrada.
*   **Caso MB-03: Comentar e Hilos de Respuestas**
    *   *Procedimiento*:
        1. Escribir un comentario raíz en un post.
        2. Hacer clic en **Responder** sobre un comentario existente y enviar la respuesta.
    *   *Resultado esperado*: Los comentarios se renderizan de forma anidada/recursiva.
*   **Caso MB-04: Reportar Contenido**
    *   *Procedimiento*: Ir a un post o comentario ajeno, hacer clic en el menú y elegir **Reportar**, seleccionar la razón y enviar.
    *   *Resultado esperado*: El reporte se registra en la base de datos como `PENDING` y se muestra en la consola del moderador.
*   **Caso MB-05: Bandeja de Notificaciones**
    *   *Procedimiento*: Navegar a `/app/notifications`.
    *   *Resultado esperado*: Se visualizan notificaciones reales (ej. cuando responden a tu comentario o aceptan tu respuesta) y permite marcarlas como leídas o eliminarlas.

### ROL: Guest (Usuario no autenticado)
*   **Caso GS-01: Restricción de Creación y Edición**
    *   *Procedimiento*: Intentar acceder directamente a `/app/communities/new`, `/app/r/comunidad-demo/new` o `/app/notifications` sin haber iniciado sesión.
    *   *Resultado esperado*: Redirección inmediata a la página de login de Clerk `/sign-in`.
*   **Caso GS-02: Restricción en Lectura de Comunidad Privada**
    *   *Procedimiento*: Intentar leer una comunidad privada o una publicación dentro de ella de forma directa por URL.
    *   *Resultado esperado*: Se muestra una pantalla de acceso restringido indicando que se requiere membresía aprobada.
