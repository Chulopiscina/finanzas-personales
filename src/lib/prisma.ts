import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function runtimeDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const isSupabaseTransactionPooler = url.hostname.includes("pooler.supabase.com") && url.port === "6543";
    if (isSupabaseTransactionPooler) {
      url.searchParams.set("pgbouncer", "true");
      url.searchParams.set("connection_limit", url.searchParams.get("connection_limit") ?? "1");
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

const datasourceUrl = runtimeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}