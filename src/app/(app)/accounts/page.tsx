import { AccountsManager } from "@/components/accounts-manager";
import { getSessionUser } from "@/lib/auth";
import { ensureDefaultAccount } from "@/lib/finance";
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Cuentas</h1>
        <p className="text-sm text-muted-foreground">Gestiona bancos, ahorro, tarjetas, efectivo e inversión.</p>
      </header>
      <AccountsManager initialAccounts={accounts} />
    </div>
  );
}