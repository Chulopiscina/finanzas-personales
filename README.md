# Finanzas personales

Aplicación privada Next.js 15 / React 19 / TypeScript, Prisma 5 y PostgreSQL. Cuentas, movimientos, extractos CSV/PDF, reembolsos, objetivos, presupuestos y pagos recurrentes. Sin registro público ni sincronización bancaria.

Guías de esta versión: [rendimiento y mediciones](docs/PERFORMANCE.md), [interpretación de extractos](docs/IMPORTS.md) y [Atajos de iPhone](docs/SHORTCUTS.md). La integración de notificaciones está desactivada por defecto y requiere migración autorizada; revisar primero la deuda de historial en [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Requisitos y arranque

Node.js 24 y PostgreSQL. No utilizar una base de producción para desarrollar o ejecutar pruebas.

```bash
npm ci
cp .env.example .env
docker compose up -d
npm run prisma:migrate
npm run db:seed
npm run dev
```

En PowerShell, `Copy-Item .env.example .env` sustituye a `cp`. Abrir http://localhost:3000.
Antes del seed, configurar correo/nombre propios, una contraseña única de al menos 12 caracteres con mayúscula, minúscula y número, y un `AUTH_SECRET` aleatorio (32 caracteres como mínimo). No hay contraseña predeterminada. El seed no cambia contraseña ni rol de usuarios existentes.

## Variables

El archivo `.env.example` contiene únicamente valores de ejemplo. No subir `.env`, tokens, claves ni extractos a Git. Los caracteres especiales de contraseñas en URLs deben codificarse como componente URI.

```env
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&schema=app"
DIRECT_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?schema=app"
AUTH_SECRET="<secreto-aleatorio-de-al-menos-32-caracteres>"
NEXT_PUBLIC_APP_URL="https://<tu-dominio>"
```

`DATABASE_URL` es la conexión de runtime por transaction pooler. `DIRECT_URL` se reserva a migraciones manuales desde una red que alcance la conexión directa. No intercambiar usuarios, puertos o hosts entre ambas. El runtime añade `pgbouncer=true` y un límite de una conexión si se usa el pooler Supabase de puerto 6543.

`INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` e `INITIAL_ADMIN_NAME` se necesitan solo para el seed inicial, ejecutado deliberadamente. Retirar la contraseña inicial del entorno tras ese uso. Las credenciales antiguas no se rotan automáticamente al desplegar: cambiarlas desde Perfil/Administración.

## Desplegar en Vercel

1. Importar el repositorio; Node 24, preset Next.js y `npm ci`.
2. Configurar las variables en Production. Preview debe usar otra base; no dar acceso de escritura a producción a ramas no confiables.
3. **Antes de publicar**, revisar y aplicar las migraciones necesarias. Seguir [el procedimiento de despliegue](docs/DEPLOYMENT.md).
4. Build: `npm run vercel-build`. Ejecuta exclusivamente `prisma generate && next build`.
5. Probar login, dashboard y aislamiento con dos usuarios de prueba.

Las migraciones nunca se ejecutan durante el build de Vercel. `npm run db:deploy` es una operación manual y aplica todas las pendientes: revisar su estado/SQL antes de ejecutarla. No usar resets ni `db push` sobre producción.

## Calidad y pruebas

```bash
npx prisma validate
npx prisma generate
npm run lint
npm run typecheck
npm test
npm run test:local-db
npx playwright install chromium
npm run test:system
npm run build
npm run vercel-build
npm audit --omit=dev
```

`npm test` ejecuta unitarias y handlers simulados; las pruebas DB/HTTP se omiten sin variables explícitas de pruebas. `test:local-db` crea un PostgreSQL local efímero, aplica migraciones solo allí y prueba integraciones reales. `test:system` añade un build, servidor Next de producción, HTTP y Chromium escritorio/móvil con datos ficticios. No necesita Docker ni usa las URLs de `.env`. Cierra servidor/base al terminar; los resultados visuales y la medición quedan en `outputs/` (ignorado por Git).

GitHub Actions repite las comprobaciones usando exclusivamente bases desechables. Activar la protección de `main` y exigir el job `verify`: el archivo de workflow por sí solo no impide que Vercel publique antes de terminar CI.

## Importación y reglas financieras

Los extractos pasan por vista previa, saldos/confianza y confirmación antes de crear movimientos. BBVA, ING, CaixaBank y CSV de Trade Republic tienen parsers específicos; un CSV genérico compatible queda con confianza baja. PDF escaneado requiere OCR externo; no se presume que se puede leer. Límites: 4 MB y 5.000 movimientos por archivo.

Los originales y las vistas previas permanecen privados en PostgreSQL, asociados a usuario y cuenta. Solo se descargan bajo sesión autorizada. Las listas no envían el contenido original. La confirmación es atómica, idempotente y serializada por cuenta.

Consultar [reglas financieras](docs/FINANCIAL_RULES.md), [despliegue](docs/DEPLOYMENT.md) e [informe de estabilización](INFORME_CORRECCIONES_FINANZAS.md) antes de usar la aplicación con más usuarios.

## Móvil y PWA

Manifest e iconos PNG, apertura standalone y metadatos de Safari. En iPhone: Compartir > Añadir a pantalla de inicio; en Android: opción de instalación del navegador cuando esté disponible. Se necesita HTTPS y conexión. No hay service worker, sincronización offline ni caché financiera persistente. La instalación en dispositivos físicos sigue pendiente de comprobación.
