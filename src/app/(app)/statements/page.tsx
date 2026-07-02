import { ImportHistoryList } from "@/components/import-history-list";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StatementsPage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const imports = await prisma.importHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { account: { select: { id: true, name: true } } }
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Extractos subidos</h1>
        <p className="text-sm text-muted-foreground">Gestiona documentos importados y sus movimientos asociados.</p>
      </header>
      <ImportHistoryList imports={imports} />
    </div>
  );
}