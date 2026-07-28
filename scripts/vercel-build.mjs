import { spawnSync } from "node:child_process";

const SUPABASE_DATABASE_URL_FORMAT = "postgresql://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?schema=app";
const SUPABASE_DIRECT_URL_FORMAT = "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?schema=app";

function readUrl(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} no esta definida. Configurala en Vercel antes de desplegar.`);
  }

  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} no es una URL PostgreSQL valida.`);
  }
}

function isPostgresUrl(url) {
  return url.protocol === "postgresql:" || url.protocol === "postgres:";
}

function validateSupabaseUrls() {
  const databaseUrl = readUrl("DATABASE_URL");
  const directUrl = readUrl("DIRECT_URL");

  if (!isPostgresUrl(databaseUrl)) {
    throw new Error("DATABASE_URL debe empezar por postgresql://");
  }
  if (!isPostgresUrl(directUrl)) {
    throw new Error("DIRECT_URL debe empezar por postgresql://");
  }

  const usesSupabase = databaseUrl.hostname.includes("supabase.com") || directUrl.hostname.includes("supabase.com");
  if (!usesSupabase) {
    return;
  }

  if (!databaseUrl.hostname.includes("pooler.supabase.com") || databaseUrl.port !== "6543") {
    throw new Error(
      `DATABASE_URL debe usar el transaction pooler de Supabase para runtime. Formato: ${SUPABASE_DATABASE_URL_FORMAT}`
    );
  }

  const databaseUser = decodeURIComponent(databaseUrl.username);
  if (!databaseUser.startsWith("postgres.")) {
    throw new Error("DATABASE_URL debe usar el usuario del pooler: postgres.<project-ref>.");
  }

  if (directUrl.hostname.includes("pooler.supabase.com")) {
    throw new Error(
      `DIRECT_URL no debe apuntar al pooler de Supabase. Para migraciones usa la conexion directa. Formato: ${SUPABASE_DIRECT_URL_FORMAT}`
    );
  }

  if (!directUrl.hostname.startsWith("db.") || !directUrl.hostname.endsWith(".supabase.co") || directUrl.port !== "5432") {
    throw new Error(
      `DIRECT_URL debe usar la conexion directa de Supabase. Formato: ${SUPABASE_DIRECT_URL_FORMAT}`
    );
  }

  if (decodeURIComponent(directUrl.username) !== "postgres") {
    throw new Error("DIRECT_URL debe usar el usuario directo postgres, no postgres.<project-ref>.");
  }
}

function commandName(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function run(command, args) {
  const result = spawnSync(commandName(command), args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  validateSupabaseUrls();
} catch (error) {
  console.error("\nConfiguracion de Supabase/Prisma incorrecta:\n");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("\nVariables esperadas en Vercel:");
  console.error(`DATABASE_URL=${SUPABASE_DATABASE_URL_FORMAT}`);
  console.error(`DIRECT_URL=${SUPABASE_DIRECT_URL_FORMAT}`);
  console.error("\nCorrige DATABASE_URL y DIRECT_URL en Vercel y vuelve a desplegar.\n");
  process.exit(1);
}

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);