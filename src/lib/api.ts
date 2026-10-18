import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { InputError } from "@/lib/input-error";
import { randomUUID } from "node:crypto";

export function jsonError(error: unknown, fallback = "Ha ocurrido un error.") {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof InputError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Ya existe un registro con esos datos." }, { status: 409 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Los datos han cambiado durante la operación. Actualiza y vuelve a intentarlo." }, { status: 409 });
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "INTERNAL";
  const reference = randomUUID();
  console.error("request_failed", { reference, code });
  const unavailable = ["P1001", "P1002", "P1008", "P1017", "P2024", "P2021", "P2022"].includes(code);
  return NextResponse.json({ error: unavailable ? "El servicio de datos no está disponible. Inténtalo de nuevo más tarde." : fallback, reference }, { status: unavailable ? 503 : 500 });
}

export async function readJson<T>(request: Request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("El cuerpo de la petición debe ser un objeto.");
    return value as T;
  } catch {
    throw new InputError("JSON inválido.");
  }
}
