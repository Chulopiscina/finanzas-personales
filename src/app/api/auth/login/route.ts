import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { checkLoginRateLimit } from "@/lib/login-rate-limit";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<LoginBody>(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password || email.length > 254 || Buffer.byteLength(password) > 72) {
      return NextResponse.json({ error: "Correo y contraseña son obligatorios." }, { status: 400 });
    }

    const limit = await checkLoginRateLimit(email, request.headers);
    if (!limit.allowed) return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await verifyPassword(password, "$2a$12$RwW5pg.IWsj7nWEuHuyEfePM1D0HSLUXwJpjjo0Y0hScwOvqr0ZBq");
      return NextResponse.json({ error: "Credenciales no válidas." }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales no válidas." }, { status: 401 });
    }

    await createSession(user, request.headers);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return jsonError(error, "No se pudo iniciar sesión.");
  }
}
