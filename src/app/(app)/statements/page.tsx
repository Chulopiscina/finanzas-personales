import { ImportHistoryList } from "@/components/import-history-list";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { statementListSelect, statementDto } from "@/lib/statement-dto";

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const params = await searchParams;
  const requested = Number(params.page ?? 1);
  const total = await prisma.importHistory.count({ where: { userId: session.user.id } });
  const pages = Math.max(1, Math.ceil(total / 25));
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  const imports = await prisma.importHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: statementListSelect, skip: (page - 1) * 25, take: 25
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Extractos subidos" description="Tus documentos y su historial de importación, siempre a mano." />
      <ImportHistoryList key={page} imports={imports.map(statementDto)} />
      <nav className="flex items-center justify-end gap-4 text-sm" aria-label="Páginas de extractos">
        {page > 1 ? <Link className="rounded-md border border-border p-3" href={`/statements?page=${page - 1}`}>Anterior</Link> : null}
        <span>{page} / {pages}</span>
        {page < pages ? <Link className="rounded-md border border-border p-3" href={`/statements?page=${page + 1}`}>Siguiente</Link> : null}
      </nav>
    </div>
  );
}
