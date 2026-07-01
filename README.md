# Finanzas personales BBVA

Aplicación web privada para finanzas personales con Next.js, TypeScript, Tailwind CSS, PostgreSQL, Prisma, sesiones seguras y gráficas con Recharts.

## Funcionalidades

- Login privado sin registro público.
- Usuario administrador inicial creado por seed.
- Roles `ADMIN` y `USER`.
- Dashboard privado por usuario.
- Importación CSV de BBVA con detección de duplicados.
- Clasificación automática por categorías y edición manual posterior.
- Métricas, gráficas, resumen mensual y recomendaciones.
- Panel ADMIN para crear, editar, eliminar usuarios, cambiar contraseñas, asignar roles y ver actividad reciente.
- Middleware de autenticación/autorización y validación de permisos en API.
- Compatible con Vercel, Supabase o PostgreSQL gestionado.

## Stack

- React + Next.js + TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Sesiones propias seguras con cookies HTTP-only, JWT firmado para middleware y tokens opacos en base de datos
- bcrypt para contraseñas
- Recharts

## Instalación local

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:migrate
npm run db:seed
npm run dev
```

Abre `http://localhost:3000`.

## Administrador inicial

El seed crea automáticamente:

- Correo: `oriolcasaponsaprat@gmail.com`
- Contraseña inicial: `Pelota.1`
- Rol: `ADMIN`

La contraseña se guarda hasheada con bcrypt. No se almacena texto plano.

## Variables de entorno

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finanzas_personales?schema=public"
AUTH_SECRET="cambia-esto-por-un-secreto-largo-de-32-caracteres-minimo"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
INITIAL_ADMIN_EMAIL="oriolcasaponsaprat@gmail.com"
INITIAL_ADMIN_PASSWORD="Pelota.1"
INITIAL_ADMIN_NAME="Oriol Casa Ponsa Prat"
```

En producción, usa un `AUTH_SECRET` largo y aleatorio.

## Supabase

1. Crea un proyecto en Supabase.
2. Copia la cadena PostgreSQL pooled o direct connection.
3. Define `DATABASE_URL` en Vercel con esa cadena.
4. Ejecuta migraciones:

```bash
npm run prisma:deploy
npm run db:seed
```

## Vercel

1. Importa el repositorio en Vercel.
2. Añade `DATABASE_URL`, `AUTH_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` e `INITIAL_ADMIN_NAME`.
3. Build command:

```bash
npm run build
```

4. Después del primer despliegue, ejecuta las migraciones contra producción:

```bash
npm run prisma:deploy
npm run db:seed
```

## CSV BBVA

El importador busca columnas habituales:

- `Fecha`
- `Concepto`
- `Importe`
- `Saldo`

También acepta variantes comunes como `Descripción`, `Movimiento`, `Cantidad` o `Saldo disponible`.

Los duplicados se evitan con una huella por usuario basada en fecha, concepto, importe y saldo.

## Seguridad

- No existe página de registro.
- Todas las rutas privadas están protegidas por middleware.
- Las APIs vuelven a comprobar sesión y rol.
- Cada movimiento pertenece a un `userId`.
- Los usuarios normales solo pueden acceder a sus propios datos.
- Cookies `httpOnly`, `sameSite=lax` y `secure` en producción.
- Contraseñas con bcrypt (`salt rounds = 12`).
- Sesiones persistidas como hash SHA-256 del token opaco.

## Scripts

```bash
npm run dev              # desarrollo
npm run build            # build Next.js + Prisma generate
npm run start            # servidor producción
npm run typecheck        # TypeScript
npm run prisma:migrate   # migración local
npm run prisma:deploy    # migración producción
npm run db:seed          # admin inicial + categorías
npm run prisma:studio    # interfaz Prisma
```


## Despliegue automatico GitHub + Vercel

El repositorio principal es:

`https://github.com/Chulopiscina/finanzas-personales.git`

Para que cada cambio se publique automaticamente:

1. Entra en Vercel y crea un proyecto nuevo importando ese repositorio de GitHub.
2. Framework preset: `Next.js`.
3. Production branch: `main`.
4. Build command: `npm run vercel-build`.
5. Install command: `npm install`.
6. Output directory: dejar vacio, Vercel lo detecta.
7. Anade las variables de entorno de produccion.

Variables necesarias en Vercel:

```env
DATABASE_URL="postgresql://postgres.qioihfkftfowabquakgh:<SUPABASE_PASSWORD>@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=app"
DIRECT_URL="postgresql://postgres.qioihfkftfowabquakgh:<SUPABASE_PASSWORD>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?schema=app"
AUTH_SECRET="un-secreto-largo-y-aleatorio-de-32-caracteres-minimo"
NEXT_PUBLIC_APP_URL="https://tu-dominio-de-vercel.vercel.app"
INITIAL_ADMIN_EMAIL="oriolcasaponsaprat@gmail.com"
INITIAL_ADMIN_PASSWORD="Pelota.1"
INITIAL_ADMIN_NAME="Oriol Casa Ponsa Prat"
```

Despues de configurar las variables, aplica migraciones y seed contra Supabase desde local usando esas mismas variables:

```bash
npm run prisma:deploy
npm run db:seed
```

Cada `git push` a `main` disparara un nuevo despliegue en Vercel.

La base de Supabase usa el esquema `app` para no tocar tablas existentes del esquema `public`. El script `vercel-build` aplica migraciones antes de compilar, asi los cambios de Prisma se despliegan junto con el codigo.

## CSV originales

Cada CSV subido se guarda en PostgreSQL dentro de `ImportHistory`, asociado al `userId` propietario. El usuario puede ver sus CSV guardados en Perfil y descargarlos. Un usuario normal solo puede descargar sus propios CSV; un administrador puede acceder a todos.
