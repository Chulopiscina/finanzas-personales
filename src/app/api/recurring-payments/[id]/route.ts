import { NextResponse } from "next/server";
import { RecurringPaymentFrequency, RecurringPaymentStatus } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RecurringPaymentBody = {
  name?: string;
  amount?: number;
  nextChargeDate?: string;
  frequency?: RecurringPaymentFrequency;
  accountId?: string | null;
  categoryId?: string | null;
  description?: string | null;
  status?: RecurringPaymentStatus;
};

const frequencies = new Set(Object.values(RecurringPaymentFrequency));
const statuses = new Set(Object.values(RecurringPaymentStatus));

async function authorize(id: string, userId: string) {
  const payment = await prisma.recurringPayment.findUnique({ where: { id } });
  if (!payment || payment.userId !== userId) return null;
  return payment;
}

async function validateBody(body: RecurringPaymentBody, userId: string) {
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) throw new Error("El nombre es obligatorio.");
    data.name = name;
  }
  if (body.amount !== undefined) {
    if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) throw new Error("El importe previsto debe ser mayor que cero.");
    data.amount = body.amount;
  }
  if (body.nextChargeDate !== undefined) {
    const date = body.nextChargeDate ? new Date(body.nextChargeDate) : null;
    if (!date || Number.isNaN(date.getTime())) throw new Error("La fecha del próximo cobro no es válida.");
    data.nextChargeDate = date;
  }
  if (body.frequency !== undefined) {
    if (!frequencies.has(body.frequency)) throw new Error("La frecuencia no es válida.");
    data.frequency = body.frequency;
  }
  if (body.status !== undefined) {
    if (!statuses.has(body.status)) throw new Error("El estado no es válido.");
    data.status = body.status;
  }
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.accountId !== undefined) {
    if (body.accountId) {
      const account = await prisma.account.findFirst({ where: { id: body.accountId, userId } });
      if (!account) throw new Error("La cuenta seleccionada no es válida.");
    }
    data.accountId = body.accountId || null;
  }
  if (body.categoryId !== undefined) {
    if (body.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: body.categoryId, OR: [{ userId: null }, { userId }] } });
      if (!category || category.isArchived) throw new Error("La categoría seleccionada no es válida.");
    }
    data.categoryId = body.categoryId || null;
  }
  return data;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const existing = await authorize(id, session.user.id);
    if (!existing) return NextResponse.json({ error: "Pago recurrente no encontrado." }, { status: 404 });
    const body = await readJson<RecurringPaymentBody>(request);
    const data = await validateBody(body, session.user.id);
    const payment = await prisma.recurringPayment.update({
      where: { id },
      data: data as never,
      include: { account: { select: { id: true, name: true } }, category: { select: { id: true, name: true, color: true } } }
    });
    return NextResponse.json({ payment });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el pago recurrente.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const existing = await authorize(id, session.user.id);
    if (!existing) return NextResponse.json({ error: "Pago recurrente no encontrado." }, { status: 404 });
    await prisma.recurringPayment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar el pago recurrente.");
  }
}
