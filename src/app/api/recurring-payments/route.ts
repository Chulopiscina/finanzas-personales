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

async function validateBody(body: RecurringPaymentBody, userId: string, partial = false) {
  const data: Record<string, unknown> = {};

  if (!partial || body.name !== undefined) {
    const name = body.name?.trim();
    if (!name) throw new Error("El nombre es obligatorio.");
    data.name = name;
  }

  if (!partial || body.amount !== undefined) {
    if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) throw new Error("El importe previsto debe ser mayor que cero.");
    data.amount = body.amount;
  }

  if (!partial || body.nextChargeDate !== undefined) {
    const date = body.nextChargeDate ? new Date(body.nextChargeDate) : null;
    if (!date || Number.isNaN(date.getTime())) throw new Error("La fecha del próximo cobro no es válida.");
    data.nextChargeDate = date;
  }

  if (!partial || body.frequency !== undefined) {
    if (!body.frequency || !frequencies.has(body.frequency)) throw new Error("La frecuencia no es válida.");
    data.frequency = body.frequency;
  }

  if (body.status !== undefined) {
    if (!statuses.has(body.status)) throw new Error("El estado no es válido.");
    data.status = body.status;
  }

  if (body.description !== undefined) {
    data.description = body.description?.trim() || null;
  }

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

export async function GET() {
  try {
    const session = await requireUser();
    const payments = await prisma.recurringPayment.findMany({
      where: { userId: session.user.id },
      include: { account: { select: { id: true, name: true } }, category: { select: { id: true, name: true, color: true } } },
      orderBy: [{ status: "asc" }, { nextChargeDate: "asc" }, { createdAt: "desc" }]
    });
    return NextResponse.json({ payments });
  } catch (error) {
    return jsonError(error, "No se pudieron cargar los pagos recurrentes.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const body = await readJson<RecurringPaymentBody>(request);
    const data = await validateBody(body, session.user.id);
    const payment = await prisma.recurringPayment.create({
      data: { ...data, userId: session.user.id, status: body.status ?? RecurringPaymentStatus.ACTIVE } as never,
      include: { account: { select: { id: true, name: true } }, category: { select: { id: true, name: true, color: true } } }
    });
    return NextResponse.json({ payment });
  } catch (error) {
    return jsonError(error, "No se pudo crear el pago recurrente.");
  }
}
