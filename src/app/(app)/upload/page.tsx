import { UploadDropzone } from "@/components/upload-dropzone";
import { getSessionUser } from "@/lib/auth";
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
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Subir CSV/PDF</h1>
        <p className="text-sm text-muted-foreground">Importación BBVA con cuenta y detección de duplicados</p>
      </header>
      <UploadDropzone accounts={accounts} />
    </div>
  );
}