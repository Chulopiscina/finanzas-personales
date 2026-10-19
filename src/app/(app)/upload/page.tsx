import { UploadDropzone } from "@/components/upload-dropzone";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ensureDefaultAccount } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export default async function UploadPage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  await ensureDefaultAccount(session.user.id);
  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id, isArchived: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, type: true, color: true }
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Subir CSV/PDF" description="Analiza tu extracto, revisa los datos y confirma antes de importar." />
      <UploadDropzone accounts={accounts} />
    </div>
  );
}
