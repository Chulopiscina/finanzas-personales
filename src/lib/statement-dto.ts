import { Prisma } from "@prisma/client";
// Originals and preview JSON are only read by the dedicated download/preview endpoints.
export const statementListSelect = {
  id: true, fileName: true, fileSize: true, rowCount: true, insertedRows: true, duplicateRows: true,
  incomeTotal: true, expenseTotal: true, status: true, createdAt: true,
  account: { select: { id: true, name: true } }
} satisfies Prisma.ImportHistorySelect;
export function statementDto(row: Prisma.ImportHistoryGetPayload<{ select: typeof statementListSelect }>) {
  return { ...row, incomeTotal: Number(row.incomeTotal), expenseTotal: Number(row.expenseTotal), createdAt: row.createdAt.toISOString() };
}
