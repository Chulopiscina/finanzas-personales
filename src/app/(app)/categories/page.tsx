import { CategoriesManager } from "@/components/categories-manager";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export default async function CategoriesPage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const categories = await prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId: session.user.id }] },
    orderBy: [{ isArchived: "asc" }, { name: "asc" }],
    include: { _count: { select: { transactions: { where: { userId: session.user.id } } } } }
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Categorías" description="Organiza tu dinero con categorías que tengan sentido para ti." />
      <CategoriesManager initialCategories={categories} />
    </div>
  );
}
