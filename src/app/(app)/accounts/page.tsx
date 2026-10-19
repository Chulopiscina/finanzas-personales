import { AccountsManager } from "@/components/accounts-manager";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { getAccountBalances, ensureDefaultAccount, toNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export default async function AccountsPage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  await ensureDefaultAccount(session.user.id);
  const accounts = await prisma.account.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { transactions: true, imports: true } } }
    });
  const balances = await getAccountBalances(session.user.id, accounts.map((account) => account.id));

  const preparedAccounts = accounts.map((account) => {
    const initialBalance = toNumber(account.initialBalance);
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalance,
      currentBalance: toNumber(balances.find((row) => row.id === account.id)?.currentBalance),
      confirmedBalance: balances.find((row) => row.id === account.id)?.confirmedBalance == null ? null : toNumber(balances.find((row) => row.id === account.id)?.confirmedBalance),
      confirmedAt: balances.find((row) => row.id === account.id)?.confirmedAt?.toISOString() ?? null,
      currency: account.currency,
      color: account.color,
      icon: account.icon,
      isArchived: account.isArchived,
      _count: account._count
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Cuentas" description="Tus bancos, tarjetas y ahorro. Una visión clara de cada saldo." />
      <AccountsManager initialAccounts={preparedAccounts} />
    </div>
  );
}
