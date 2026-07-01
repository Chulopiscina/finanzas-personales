import { TransactionsTable } from "@/components/transactions-table";
import { getAuthorizedUserId, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{ userId?: string }>;
};

function toNumber(value: unknown) {
  return Number(value && typeof value === "object" && "toString" in value ? value.toString() : value);
}

export default async function MovementsPage({ searchParams }: Props) {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const params = await searchParams;
  const userId = getAuthorizedUserId(session.user, params?.userId);
  const [transactions, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Movimientos</h1>
        <p className="text-sm text-muted-foreground">Clasificación y edición manual</p>
      </header>
      <TransactionsTable
        categories={categories}
        initialTransactions={transactions.map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString(),
          concept: tx.concept,
          amount: toNumber(tx.amount),
          balance: tx.balance === null ? null : toNumber(tx.balance),
          type: tx.type,
          categoryId: tx.categoryId,
          category: tx.category
        }))}
      />
    </div>
  );
}
