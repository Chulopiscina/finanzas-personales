import { ImportHistoryList } from "@/components/import-history-list";
import { ProfileForm } from "@/components/profile-form";
import { PageHeader } from "@/components/page-header";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statementListSelect, statementDto } from "@/lib/statement-dto";

export default async function ProfilePage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const imports = await prisma.importHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: statementListSelect
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Perfil" description="Tu información personal y la seguridad de tu cuenta." />
      <ProfileForm user={session.user} />
      <ImportHistoryList imports={imports.map(statementDto)} />
    </div>
  );
}
