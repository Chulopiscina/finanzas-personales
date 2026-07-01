import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";

export function jsonError(error: unknown, fallback = "Ha ocurrido un error.") {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Ya existe un registro con esos datos." }, { status: 409 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message || fallback }, { status: 400 });
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function readJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("JSON inválido.");
  }
}
