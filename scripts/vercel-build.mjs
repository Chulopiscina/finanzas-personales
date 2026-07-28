import { spawnSync } from "node:child_process";

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

function validateSupabaseUrls() {
  const databaseUrl = readUrl("DATABASE_URL");
  const directUrl = readUrl("DIRECT_URL");

  const usesSupabase = databaseUrl.hostname.includes("supabase.com") || directUrl.hostname.includes("supabase.com");
  if (!usesSupabase) {
    return;
  }

  if (!databaseUrl.hostname.includes("pooler.supabase.com") || databaseUrl.port !== "6543") {
    throw new Error(
      "DATABASE_URL debe usar el pooler transaccional de Supabase para runtime: aws-...pooler.supabase.com:6543 con pgbouncer=true."
    );
  }

  if (!databaseUrl.searchParams.has("pgbouncer")) {
    throw new Error("DATABASE_URL debe incluir pgbouncer=true para Prisma en runtime con Supabase pooler.");
  }

  if (directUrl.hostname.includes("pooler.supabase.com")) {
    throw new Error(
      "DIRECT_URL no debe apuntar al pooler de Supabase. Para migraciones usa la conexion directa: postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?schema=app"
    );
  }

  if (!directUrl.hostname.startsWith("db.") || !directUrl.hostname.endsWith(".supabase.co") || directUrl.port !== "5432") {
    throw new Error(
      "DIRECT_URL debe usar la conexion directa de Supabase: db.<project-ref>.supabase.co:5432. No uses aws-...pooler.supabase.com:5432."
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
  console.error("\nCorrige las variables DATABASE_URL y DIRECT_URL en Vercel y vuelve a desplegar.\n");
  process.exit(1);
}

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);