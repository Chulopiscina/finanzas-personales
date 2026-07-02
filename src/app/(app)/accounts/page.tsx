import { AccountsManager } from "@/components/accounts-manager";
import { getSessionUser } from "@/lib/auth";
import { ensureDefaultAccount, toNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export default async function AccountsPage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  await ensureDefaultAccount(session.user.id);
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { transactions: true, imports: true } } }
    }),
    prisma.transaction.findMany({
      where: { userId: session.user.id },
      select: { accountId: true, amount: true, balance: true, date: true, createdAt: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    })
  ]);

  const totals = new Map<string, { movementTotal: number; latestBalance: number | null }>();
  for (const transaction of transactions) {
    const current = totals.get(transaction.accountId) ?? { movementTotal: 0, latestBalance: null };
    current.movementTotal += toNumber(transaction.amount);
    if (current.latestBalance === null && transaction.balance !== null) {
      current.latestBalance = toNumber(transaction.balance);
    }
    totals.set(transaction.accountId, current);
  }

  const preparedAccounts = accounts.map((account) => {
    const initialBalance = toNumber(account.initialBalance);
    const accountTotals = totals.get(account.id) ?? { movementTotal: 0, latestBalance: null };
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalance,
      currentBalance: accountTotals.latestBalance ?? initialBalance + accountTotals.movementTotal,
      currency: account.currency,
      color: account.color,
      icon: account.icon,
      isArchived: account.isArchived,
      _count: account._count
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Cuentas</h1>
        <p className="text-sm text-muted-foreground">Gestiona bancos, ahorro, tarjetas, efectivo e inversión.</p>
      </header>
      <AccountsManager initialAccounts={preparedAccounts} />
    </div>
  );
}
