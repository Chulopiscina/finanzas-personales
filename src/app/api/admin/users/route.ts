import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { assertPasswordStrength, hashPassword, requireAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type CreateUserBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const role = request.nextUrl.searchParams.get("role") as Role | null;

    const users = await prisma.user.findMany({
      where: {
        role: role && Object.values(Role).includes(role) ? role : undefined,
        OR: q
          ? [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json({ users });
  } catch (error) {
    return jsonError(error, "No se pudieron cargar usuarios.");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readJson<CreateUserBody>(request);
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nombre, correo y contraseña son obligatorios." }, { status: 400 });
    }

    assertPasswordStrength(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: body.role === Role.ADMIN ? Role.ADMIN : Role.USER
      },
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

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return jsonError(error, "No se pudo crear el usuario.");
  }
}
