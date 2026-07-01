import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { assertPasswordStrength, hashPassword, requireAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type UpdateUserBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        _count: { select: { transactions: true, imports: true } }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error, "No se pudo cargar el usuario.");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await readJson<UpdateUserBody>(request);
    const data: {
      name?: string;
      email?: string;
      passwordHash?: string;
      role?: Role;
    } = {};

    if (body.name?.trim()) {
      data.name = body.name.trim();
    }

    if (body.email?.trim()) {
      data.email = body.email.trim().toLowerCase();
    }

    if (body.role && Object.values(Role).includes(body.role)) {
      data.role = body.role;
    }

    if (body.password) {
      assertPasswordStrength(body.password);
      data.passwordHash = await hashPassword(body.password);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        _count: { select: { transactions: true, imports: true } }
      }
    });

    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el usuario.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json({ error: "No puedes eliminar tu propio usuario administrador." }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar el usuario.");
  }
}
