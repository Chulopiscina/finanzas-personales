// Synthetic data only, used by the disposable local browser-test database.
export async function seedVisualFixture(db, passwordHash) {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "http://invalid");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/finanzas_test"
  )
    throw new Error("Visual fixtures require the isolated test database");
  const email = "design-fixture@example.test";
  const user = await db.user.create({
    data: { name: "Auditoría Visual", email, passwordHash, role: "ADMIN" },
  });
  const account = await db.account.create({
    data: {
      userId: user.id,
      name: "Cuenta principal",
      color: "#65d9aa",
      initialBalance: 1800,
    },
  });
  await db.account.create({
    data: {
      userId: user.id,
      name: "Cuenta ahorro",
      color: "#82b2e8",
      type: "SAVINGS",
      initialBalance: 3200,
    },
  });
  const categoryNames = [
    "Vivienda",
    "Supermercado",
    "Restaurantes",
    "Transporte",
    "Suscripciones",
    "Gasto de prueba",
  ];
  const categories = [];
  for (const [index, name] of categoryNames.entries())
    categories.push(
      await db.category.create({
        data: {
          userId: user.id,
          name,
          type: "EXPENSE",
          color: [
            "#65d9aa",
            "#82b2e8",
            "#e4b77d",
            "#b4a0db",
            "#db8f9e",
            "#7fc5c1",
          ][index],
          icon: "circle-dot",
        },
      }),
    );
  const salary = await db.category.create({
    data: {
      userId: user.id,
      name: "Nómina",
      type: "INCOME",
      color: "#65d9aa",
      icon: "circle-dot",
    },
  });
  const now = new Date();
  const rows = [];
  for (let offset = 3; offset >= 0; offset--) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );
    rows.push({
      userId: user.id,
      accountId: account.id,
      categoryId: salary.id,
      date,
      concept: "Nómina de prueba",
      amount: 2400 + (3 - offset) * 80,
      type: "INCOME",
      sourceHash: "visual-income-" + offset,
    });
    for (const [index, category] of categories.entries())
      rows.push({
        userId: user.id,
        accountId: account.id,
        categoryId: category.id,
        date,
        concept: category.name + " de prueba",
        rawDescription: "Movimiento ficticio para revisión visual",
        amount: -([620, 195, 96, 68, 32, 45][index] + offset * 6),
        type: "EXPENSE",
        isFixedExpense: index === 0 || index === 4,
        sourceHash: "visual-expense-" + offset + "-" + index,
      });
  }
  await db.transaction.createMany({ data: rows });
  await db.monthlyBudget.create({
    data: {
      userId: user.id,
      month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      expectedIncome: 2640,
      fixedLimit: 750,
      variableLimit: 450,
      extraLimit: 200,
      savingsGoal: 400,
    },
  });
  await db.planningGoal.create({
    data: {
      userId: user.id,
      name: "Fondo de emergencia",
      type: "SAVINGS",
      targetAmount: 400,
      color: "#82b2e8",
      showInDashboard: true,
    },
  });
  await db.recurringPayment.create({
    data: {
      userId: user.id,
      accountId: account.id,
      name: "Seguro del coche",
      amount: 450,
      nextChargeDate: new Date(Date.now() + 12 * 86400000),
      frequency: "ANNUAL",
    },
  });
  await db.importHistory.create({
    data: {
      userId: user.id,
      accountId: account.id,
      fileName: "extracto-demostracion.csv",
      fileHash: "visual-synthetic-document",
      rowCount: rows.length,
      insertedRows: rows.length,
      duplicateRows: 0,
      status: "COMPLETED",
      bankName: "Datos ficticios",
    },
  });
  return email;
}
