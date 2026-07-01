import { NextResponse } from "next/server";
import { assertPasswordStrength, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type ProfileBody = {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
};

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    const body = await readJson<ProfileBody>(request);
    const data: { name?: string; email?: string; passwordHash?: string } = {};

    if (body.name?.trim()) {
      data.name = body.name.trim();
    }

    if (body.email?.trim()) {
      data.email = body.email.trim().toLowerCase();
    }

    if (body.newPassword) {
      assertPasswordStrength(body.newPassword);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
      const validCurrent = await verifyPassword(body.currentPassword ?? "", user.passwordHash);
      if (!validCurrent) {
        return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
      }

      data.passwordHash = await hashPassword(body.newPassword);
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true }
    });

    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el perfil.");
  }
}
