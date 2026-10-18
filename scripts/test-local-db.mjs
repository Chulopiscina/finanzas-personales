import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const root = resolve(tmpdir());
const directory = await mkdtemp(join(root, "finanzas-tests-"));
if (!resolve(directory).startsWith(root + "\\") && !resolve(directory).startsWith(root + "/")) throw new Error("Invalid test directory");
const password = randomBytes(24).toString("hex");
const pg = new EmbeddedPostgres({ databaseDir: directory, port, user: "postgres", password, persistent: false, postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {} });
const url = `postgresql://postgres:${password}@127.0.0.1:${port}/finanzas_test?schema=app`;
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, TEST_DATABASE_URL: url, AUTH_SECRET: randomBytes(32).toString("hex"), SHORTCUTS_ENABLED: "true" };
// Syntactic fixture only. Browser tests never install this nonexistent iCloud shortcut.
env.SHORTCUTS_BBVA_INSTALL_URL = "https://www.icloud.com/shortcuts/" + "0".repeat(32);
let app;
let resultCode = 1;
async function run(args) {
  const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
  return new Promise((resolve, reject) => { child.on("error", reject); child.on("exit", (code) => resolve(code ?? 1)); });
}
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase("finanzas_test");
  console.log("PostgreSQL de pruebas aislado iniciado; no se utilizan las conexiones del archivo .env.");
  let code = await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  if (!code && process.argv.includes("--web")) {
    const { PrismaClient } = await import("@prisma/client");
    const { default: bcrypt } = await import("bcryptjs");
    const db = new PrismaClient({ datasources: { db: { url } } });
    env.E2E_EMAIL = "browser-fixture@example.test"; env.E2E_PASSWORD = password + "A1";
    const user = await db.user.create({ data: { name: "Auditoría", email: env.E2E_EMAIL, passwordHash: await bcrypt.hash(env.E2E_PASSWORD, 12) } });
    const account = await db.account.create({ data: { userId: user.id, name: "Cuenta de prueba" } });
    await db.account.create({ data: { userId: user.id, name: "Ahorro de prueba", type: "SAVINGS" } });
    const category = await db.category.create({ data: { userId: user.id, name: "Gasto de prueba", type: "EXPENSE", color: "#22c55e", icon: "circle-dot" } });
    const date = new Date();
    await db.transaction.createMany({ data: Array.from({ length: 60 }, (_, i) => ({ userId: user.id, accountId: account.id, categoryId: category.id, date, concept: "Compra de prueba " + i, amount: -1, type: "EXPENSE", sourceHash: "browser-" + i })) });
    await db.transaction.create({ data: { userId: user.id, accountId: account.id, date, concept: "Ingreso de prueba", amount: 1000, type: "INCOME", sourceHash: "browser-income" } });
    await db.$disconnect();
    code = await run(["node_modules/next/dist/bin/next", "build"]);
    if (!code) {
      const listener = createServer(); await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
      const webPort = listener.address().port; await new Promise((resolve) => listener.close(resolve));
      env.TEST_APP_URL = `http://127.0.0.1:${webPort}`;
      app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(webPort)], { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      app.stdout.on("data", () => {}); app.stderr.on("data", (data) => process.stderr.write(data.toString().replaceAll(password, "[redacted]")));
      let ready = false;
      for (let i = 0; i < 80; i++) {
        try { const response = await fetch(env.TEST_APP_URL + "/login"); if (response.ok) { ready = true; break; } } catch {}
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!ready) throw new Error("El servidor de pruebas no arrancó.");
    }
  }
  if (!code) code = await run(["node_modules/vitest/vitest.mjs", "run"]);
  if (!code && app) code = await run(["node_modules/@playwright/test/cli.js", "test"]);
  resultCode = code;
} finally {
  if (app && app.exitCode === null) { app.kill(); await new Promise((resolve) => app.once("exit", resolve)); }
  await pg.stop();
}
process.exit(resultCode);
