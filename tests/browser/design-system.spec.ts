import { expect, test } from "@playwright/test";

test.skip(
  !process.env.TEST_APP_URL,
  "Solo servidor aislado de npm run test:system.",
);

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env.E2E_DESIGN_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Hola Auditoría/ }),
  ).toBeVisible();
}

test("diseño: pantallas principales, temas, gráficos y navegación responsive", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.goto("/dashboard?period=all");
  await page
    .getByRole("heading", { name: "Gráficos", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(page.locator(".recharts-sector").first()).toBeVisible();
  const legend = page.getByRole("button", { name: /Gasto de prueba/ }).first();
  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "true");
  const trend = page.getByRole("group", { name: "Serie de evolución" });
  await trend.getByRole("button", { name: "Ingresos", exact: true }).click();
  await expect(
    trend.getByRole("button", { name: "Ingresos", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("dashboard-dark-viewport.png"),
  });
  await page.screenshot({
    path: info.outputPath("dashboard-dark.png"),
    fullPage: true,
  });
  const routes = [
    "movements",
    "statistics",
    "accounts",
    "statements",
    "planning",
    "planning/budget",
    "planning/recurring-payments",
    "categories",
    "profile",
    "upload",
    "notifications",
    "admin",
  ];
  for (const route of routes) {
    await page.goto("/" + route);
    await expect(page.locator("main h1")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(route.replaceAll("/", "-") + "-dark.png"),
      fullPage: true,
    });
  }
  await page.goto("/dashboard");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Más secciones" }).click();
    await expect(
      page.getByRole("dialog", { name: "Menú de navegación" }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Cambiar a modo claro" }).click();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Cerrar menú" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page
    .getByRole("heading", { name: "Gráficos", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(page.locator(".recharts-sector").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("dashboard-light.png"),
    fullPage: true,
  });
  if (info.project.name !== "mobile") {
    await page.getByRole("button", { name: "Contraer menú" }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Expandir menú" }).last(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Movimientos", exact: true }).click();
    await expect(page.locator("main h1")).toHaveText("Movimientos");
  }
  if (info.project.name === "mobile") {
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dashboard?period=all");
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `ancho ${width}`).toBe(true);
      await page.screenshot({ path: info.outputPath(`dashboard-${width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});

test("diseño: cuentas, categorías y pagos conservan sus formularios y edición", async ({
  page,
}, info) => {
  await login(page);
  const suffix = info.project.name;
  await page.goto("/accounts");
  await page.locator("summary").filter({ hasText: "Crear cuenta" }).click();
  await page
    .getByLabel("Nombre de nueva cuenta")
    .fill("Cuenta visual " + suffix);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  const account = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Cuenta visual " + suffix,
      exact: true,
    }),
  });
  await expect(account).toBeVisible();
  await account.getByRole("button", { name: "Editar", exact: true }).click();
  await account
    .getByLabel("Nombre de la cuenta", { exact: true })
    .fill("Cuenta editada " + suffix);
  await account.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Cuenta editada " + suffix,
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/categories");
  await page.locator("summary").filter({ hasText: "Nueva categoría" }).click();
  await page
    .getByLabel("Nombre de categoría", { exact: true })
    .fill("Categoría visual " + suffix);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  const category = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Categoría visual " + suffix,
      exact: true,
    }),
  });
  await expect(category).toBeVisible();
  await category.getByRole("button", { name: "Editar", exact: true }).click();
  await category
    .getByLabel("Editar nombre de categoría")
    .fill("Categoría editada " + suffix);
  await category.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Categoría editada " + suffix,
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/planning");
  await page
    .getByRole("navigation", { name: "Secciones de planificación" })
    .getByRole("link", { name: "Pagos recurrentes" })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: "Añadir pago recurrente" })
    .click();
  await expect(
    page.getByRole("button", { name: "Crear pago", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
