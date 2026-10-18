# Despliegue seguro y migración pendiente

## Estado de esta intervención

No se ha conectado a producción ni ejecutado allí migraciones. No se han alterado usuarios, sesiones ni datos bancarios reales. La autenticación de Vercel CLI no estaba disponible y no se ha validado el estado real de Supabase. Un build correcto no demuestra que sus tablas existan.

La nueva versión **requiere** `LoginRateLimit` antes de servir login. Por seguridad falla cerrada si falta esa tabla: no sustituye la protección por un contador en memoria. Por este motivo no publicar automáticamente hasta verificar la migración.

## Antes de aplicar

1. Tener backup/snapshot y un entorno de staging con copia anonimizada.
2. Configurar localmente `DIRECT_URL` y `DATABASE_URL` desde el gestor de secretos; ambas con el mismo esquema `app` en este proyecto. No escribir claves en comandos/versionado ni compartir su salida sin ocultarlas.
3. Desde una red que alcance la conexión directa, ejecutar `npx prisma migrate status`. Si hay migraciones fallidas o antiguas pendientes, **detenerse y revisar cada SQL**: `db:deploy` aplica todas, no solo la última.
4. La única migración nueva de esta intervención es `20261018130000_login_rate_limit`. Crea una tabla auxiliar y un índice de caducidad. No añade ni modifica columnas financieras. Sus claves son HMAC, no correos/IP en claro.

Si las anteriores están aplicadas y solo falta esta:

```bash
npm run db:deploy
npx prisma migrate status
```

Es un paso manual previo a publicar, nunca un paso de Vercel. Si falla la red/IPv6, no cambiar a un host supuesto ni usar `migrate reset`; ejecutar desde una red compatible o seguir el SQL revisado abajo.

## Alternativa SQL explícita en Supabase

Primero verificar que se trata del proyecto/esquema correcto y que la tabla no existe:

```sql
SELECT to_regclass('app."LoginRateLimit"');
SELECT migration_name, finished_at, rolled_back_at
FROM app._prisma_migrations
ORDER BY started_at;
```

Si solo falta la migración nueva y no hay un estado fallido, su SQL es:

```sql
BEGIN;
CREATE TABLE app."LoginRateLimit" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginRateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "LoginRateLimit_expiresAt_idx"
  ON app."LoginRateLimit"("expiresAt");
COMMIT;
```

No ejecutar de nuevo si existe. Comparar columnas/defaults/PK/índice con `prisma/migrations/20261018130000_login_rate_limit/migration.sql`. Solo después de comprobar que el SQL completo se aplicó correctamente, registrar esa aplicación con conexión directa accesible:

```bash
npx prisma migrate resolve --applied 20261018130000_login_rate_limit
npx prisma migrate status
```

No marcar otras migraciones como aplicadas ni editar `_prisma_migrations` a mano. Si ya consta fallida, investigar primero su log; no usar `resolve` para ocultar diferencias.

El rollback de aplicación puede volver al commit anterior conservando esta tabla auxiliar; no requiere borrar tablas o datos. La caducidad elimina solo contadores vencidos durante nuevos intentos permitidos.

## Configuración y comprobación posterior

- Node 24 y build `npm run vercel-build` (generate + build, sin migraciones).
- Runtime `DATABASE_URL`: transaction pooler 6543, usuario `postgres.<project-ref>`, `pgbouncer=true&connection_limit=1&schema=app`.
- Migraciones `DIRECT_URL`: `db.<project-ref>.supabase.co:5432`, usuario `postgres`, mismo esquema. No se cambia ninguna URL real durante esta intervención.
- `AUTH_SECRET` aleatorio >=32 caracteres; no reutilizar claves de ejemplo.
- Rotar contraseñas iniciales antiguas desde una sesión autorizada. Si cambian contraseña o rol se revocan sesiones persistidas; si se rota `AUTH_SECRET`, volver a iniciar sesión.
- Probar con dos usuarios de staging: listas privadas, identificadores ajenos rechazados, importación previa sin movimientos creados, doble confirmación idempotente, transferencia vinculada/desvinculada y reembolso.
- Revisar Runtime Logs sin copiar valores sensibles; los errores de API incluyen una referencia, no cadenas de conexión.
- Activar protección de rama `main` y requerir `verify`. Vercel y Actions no quedan encadenados automáticamente por añadir YAML.
- No exponer el esquema financiero `app` mediante Supabase Data API. Esta app usa Prisma en servidor; no entrega `service_role` ni conexión PostgreSQL al navegador. Verificar permisos/RLS de Supabase antes de cualquier cliente directo futuro.

## Límites de la validación

Las migraciones completas se han probado en PostgreSQL local desechable, no en Supabase existente. Faltan smoke tests del despliegue, accesibilidad física iPhone/Android y una restauración de backup comprobada. No invitar a la familia hasta completar esos pasos.
