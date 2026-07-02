import { CategoriesManager } from "@/components/categories-manager";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CategoriesPage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const categories = await prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId: session.user.id }] },
    orderBy: [{ isArchived: "asc" }, { name: "asc" }],
    include: { _count: { select: { transactions: true } } }
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Categorías</h1>
        <p className="text-sm text-muted-foreground">Crea categorías nuevas y archiva las que ya no uses.</p>
      </header>
      <CategoriesManager initialCategories={categories} />
    </div>
  );
}