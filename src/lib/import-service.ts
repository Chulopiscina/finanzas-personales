import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InputError } from "@/lib/input-error";
import { deserializePreviewMovement, type ImportPreviewData } from "@/lib/import-preview";
import { planImport } from "@/lib/import-identity";
import { canonicalCategoryName, getOrCreateImportCategory } from "@/lib/import-categories";
import { accountingType } from "@/lib/ledger";
import { reconcileNotifications } from "@/lib/shortcuts";

export async function lockImportAccount(tx: Prisma.TransactionClient, userId: string, accountId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${userId}), hashtext(${accountId}))`;
}

export async function confirmStatement(id: string, actor: { id: string; role: Role }, force: boolean) {
  return prisma.$transaction(async (tx) => {
    const imported = await tx.importHistory.findFirst({ where: { id, ...(actor.role === "ADMIN" ? {} : { userId: actor.id }) }, include: { account: true } });
    if (!imported) throw new InputError("Extracto no encontrado.", 404);
    await lockImportAccount(tx, imported.userId, imported.accountId);
    const current = await tx.importHistory.findUniqueOrThrow({ where: { id } });
    if (current.status === "COMPLETED") return { ...current, accountName: imported.account.name };
    if (current.status !== "PENDING" || imported.account.isArchived) throw new InputError("El extracto no está pendiente o su cuenta está archivada.");
    const preview = current.previewData as ImportPreviewData | null;
    if (!preview || !Array.isArray(preview.movements) || !preview.movements.length || preview.validationStatus === "error") throw new InputError("El extracto no tiene una vista previa válida.");
    if (preview.confidence === "baja" && !force) throw new InputError("Confirma expresamente la importación de confianza baja.", 409);
    const movements = preview.movements.map(deserializePreviewMovement);
    const dates = movements.map((m) => m.date.getTime());
    const existing = await tx.transaction.findMany({ where: { userId: imported.userId, accountId: imported.accountId, date: { gte: new Date(Math.min(...dates)), lte: new Date(Math.max(...dates)) } }, select: { date: true, concept: true, rawDescription: true, amount: true, balance: true, raw: true } });
    const plan = planImport(movements, existing);
    const categoryMap = new Map<string, string>();
    for (const name of new Set(plan.inserts.map((m) => canonicalCategoryName(m.categoryName)))) {
      const category = await getOrCreateImportCategory(name, imported.userId, tx);
      categoryMap.set(name, category.id);
    }
    if (plan.inserts.length) await tx.transaction.createMany({ data: plan.inserts.map((m) => ({ userId: imported.userId, accountId: imported.accountId, importHistoryId: id, categoryId: categoryMap.get(canonicalCategoryName(m.categoryName)), date: m.date, concept: m.concept, cleanDescription: m.cleanDescription, rawDescription: m.concept, amount: m.amount, balance: m.balance, type: accountingType({ amount: m.amount, isInternalTransfer: false }), sourceHash: m.sourceHash, raw: m.raw })) });
    await reconcileNotifications(tx, imported.userId, imported.accountId);
    const result = await tx.importHistory.update({ where: { id }, data: { status: "COMPLETED", insertedRows: plan.inserts.length, duplicateRows: plan.duplicates, confirmedAt: new Date(), errorMessage: null } });
    return { ...result, accountName: imported.account.name };
  }, { maxWait: 10_000, timeout: 30_000 });
}
