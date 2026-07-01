import { ImportHistoryList } from "@/components/import-history-list";
import { ProfileForm } from "@/components/profile-form";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const imports = await prisma.importHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      rowCount: true,
      insertedRows: true,
      duplicateRows: true,
      createdAt: true
    }
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Perfil</h1>
        <p className="text-sm text-muted-foreground">Datos personales y contraseña</p>
      </header>
      <ProfileForm user={session.user} />
      <ImportHistoryList imports={imports} />
    </div>
  );
}
