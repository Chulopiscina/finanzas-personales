import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { madridToday, shiftCalendarMonth } from "../../src/lib/recurring-calendar";

test.skip(!process.env.TEST_APP_URL, "Solo servidor y base de datos locales aislados.");

async function paymentActions(page: Page, name: string) {
  const row = page.getByTestId("configured-payment").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await row.getByLabel(`Acciones de ${name}`, { exact: true }).click();
  return row;
}

test("Dashboard: widget compacto con logos oficiales; gestión y aislamiento intactos", async ({ page }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const url = new URL(process.env.TEST_DATABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/finanzas_test") throw new Error("Solo datos ficticios locales.");
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const email = `calendar-${crypto.randomUUID()}@example.test`;
  const today = madridToday();
  const month = today.slice(0, 7);
  let accountId = "";
  const definitions = [
    ["Netflix", 14.99, "05"], ["DIGI", 20, "07"], ["Movistar", 35, "08"],
    ["Spotify Familiar", 20.99, today.slice(8)], ["Disney+", 8.99, "28"],
    ["Synergym", 29.99, "12"], ["Google One", 1.99, "13"], ["ChatGPT Plus", 23, "27"],
  ] as const;
  try {
    const user = await db.user.create({ data: { name: "Calendario", email, passwordHash: await bcrypt.hash(process.env.E2E_PASSWORD!, 12) } });
    const account = await db.account.create({ data: { userId: user.id, name: "Cuenta de prueba" } });
    accountId = account.id;
    const other = await db.account.create({ data: { userId: user.id, name: "Otra cuenta" } });
    const foreign = await db.user.create({ data: { name: "Otro usuario", email: `foreign-${crypto.randomUUID()}@example.test`, passwordHash: "unusable-fixture" } });
    await db.recurringPayment.create({ data: { userId: foreign.id, name: "Pago privado de otro usuario", amount: 999, frequency: "MONTHLY", nextChargeDate: new Date(today) } });
    await db.transaction.create({ data: { userId: user.id, accountId, date: new Date(), amount: -10, type: "EXPENSE", concept: "Movimiento ficticio intacto", sourceHash: crypto.randomUUID() } });
    await db.recurringPayment.createMany({ data: [
      ...definitions.map(([name, amount, day]) => ({ userId: user.id, accountId, name, amount, frequency: "MONTHLY" as const, nextChargeDate: new Date(`${month}-${day}`) })),
      { userId: user.id, accountId: other.id, name: "Pago de otra cuenta", amount: 19, frequency: "MONTHLY", nextChargeDate: new Date(today) },
      { userId: user.id, accountId, name: "Pago pausado", amount: 25, status: "PAUSED", frequency: "MONTHLY", nextChargeDate: new Date(today) },
    ] });
  } finally { await db.$disconnect(); }

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator("main h1")).toContainText("Hola");
  const before = await (await page.request.get("/api/transactions?pageSize=25")).json();
  const dashboard = await (await page.request.get("/api/dashboard")).json();
  expect(dashboard.recurringSchedule.some((item: { name: string }) => item.name.includes("privado"))).toBe(false);
  const widget = page.getByTestId("recurring-payments-widget");
  await expect(widget).toBeVisible();
  await expect(widget.getByTestId("widget-payment")).toHaveCount(9);
  await page.getByLabel("Seleccionar cuenta", { exact: true }).selectOption(accountId);
  await expect(widget.getByTestId("widget-payment")).toHaveCount(8);
  await expect(widget.getByText("Pago de otra cuenta", { exact: true })).toHaveCount(0);
  await expect(widget.getByText("Pago pausado", { exact: true })).toHaveCount(0);
  await expect(widget.getByText("Pagado", { exact: true })).toHaveCount(0);
  for (const brand of ["Netflix", "Spotify", "Disney+", "DIGI", "Movistar"]) {
    await expect(widget.getByRole("img", { name: `Logo de ${brand}`, exact: true }).first()).toBeVisible();
  }
  // Lazy logos must be checked when brought on screen, including the scrollable list.
  for (const image of await widget.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
  }
  await widget.getByRole("region", { name: "Pagos del mes seleccionado" }).evaluate((node) => { node.scrollTop = 0; });
  const assets = await widget.locator("img").evaluateAll((images) => images.map((node) => ({
    src: node.getAttribute("src"), loaded: (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0,
  })));
  expect(assets.every((asset) => {
    const source = new URL(asset.src!, process.env.TEST_APP_URL!);
    return asset.loaded && source.origin === new URL(process.env.TEST_APP_URL!).origin && source.pathname.startsWith("/service-logos/");
  })).toBe(true);
  const dates = await widget.getByTestId("widget-payment").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-date")));
  expect(dates).toEqual([...dates].sort());
  await widget.locator('[aria-current="date"]').click();
  await expect(widget.getByTestId("widget-payment").filter({ hasText: "Spotify Familiar" })).toBeVisible();
  await expect(widget.getByTestId("widget-payment").filter({ hasText: "Spotify Familiar" })).toContainText("Hoy");
  await widget.getByRole("button", { name: "Ver mes", exact: true }).click();
  await widget.getByRole("button", { name: "Mes siguiente de pagos" }).click();
  await expect(widget.getByLabel("Elegir mes de pagos")).toHaveValue(shiftCalendarMonth(month, 1));
  await widget.getByRole("button", { name: "Mes actual", exact: true }).click();
  await widget.getByLabel("Elegir mes de pagos").fill(shiftCalendarMonth(month, -1));
  await expect(widget.getByText("Sin pagos previstos para este mes.")).toBeVisible();
  await widget.getByRole("button", { name: "Mes actual", exact: true }).click();
  await widget.screenshot({ path: info.outputPath("dashboard-payments-widget-dark.png") });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("dashboard-integrated-payments.png"), fullPage: true });
  const box = await widget.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(440);
  if (info.project.name === "desktop") expect(box!.width).toBeLessThan(500);
  for (const width of info.project.name === "mobile" ? [320, 390, 768] : [1280, 1600]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `ancho ${width}`).toBe(true);
    expect(await widget.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }

  await widget.getByRole("link", { name: "Gestionar pagos recurrentes", exact: true }).click();
  await expect(page.locator("main h1")).toHaveText("Pagos recurrentes");
  await expect(page.getByTestId("recurring-payments-widget")).toHaveCount(0);
  let row = await paymentActions(page, "Spotify Familiar");
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Editar pago recurrente" });
  await dialog.getByLabel("Importe previsto (€)").fill("12.99");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText("12,99");
  row = await paymentActions(page, "Spotify Familiar");
  await row.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(row).toContainText("Pausado");
  row = await paymentActions(page, "Spotify Familiar");
  await row.getByRole("button", { name: "Reactivar", exact: true }).click();
  await expect(row).toContainText("Activo");
  await page.route("**/api/recurring-payments/*", (route) => route.abort());
  row = await paymentActions(page, "Spotify Familiar");
  await row.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "conexión" })).toBeVisible();
  await expect(row).toContainText("Activo");
  await page.unroute("**/api/recurring-payments/*");
  const create = page.locator("details.payment-create");
  await create.locator("summary").click();
  await create.getByLabel("Nombre", { exact: true }).fill("Pago nuevo de prueba");
  await create.getByLabel("Importe previsto (€)").fill("49.95");
  await create.getByLabel("Fecha del próximo cobro").fill(today);
  await create.getByRole("button", { name: "Crear pago", exact: true }).click();
  const added = await paymentActions(page, "Pago nuevo de prueba");
  page.once("dialog", (confirm) => confirm.accept());
  await added.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(added).toHaveCount(0);
  await page.getByRole("link", { name: "Ver calendario", exact: true }).click();
  await expect(page).toHaveURL(/dashboard#pagos-recurrentes/);
  await expect(widget).toBeVisible();
  const after = await (await page.request.get("/api/transactions?pageSize=25")).json();
  expect(after).toEqual(before);
  expect(errors).toEqual([]);
});
