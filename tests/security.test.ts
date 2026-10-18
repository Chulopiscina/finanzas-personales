import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ user: { id: "alice", role: "USER" }, category: { findMany: vi.fn() }, transaction: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() }, account: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: { category: mocks.category, transaction: mocks.transaction, account: mocks.account } }));
vi.mock("@/lib/auth", async (original) => ({ ...await original<typeof import("@/lib/auth")>(), requireUser: async () => ({ user: mocks.user }) }));
import { GET as transactions } from "@/app/api/transactions/route";
import { GET as categories } from "@/app/api/categories/route";
import { PATCH as account } from "@/app/api/accounts/[id]/route";
import { GET as candidates } from "@/app/api/transactions/[id]/candidates/route";
import { getAuthorizedUserId } from "@/lib/auth";
import { jsonError } from "@/lib/api";
describe("aislamiento entre usuarios: handlers", () => {
  beforeEach(() => { mocks.user.id = "alice"; mocks.user.role = "USER"; mocks.category.findMany.mockResolvedValue([]); mocks.transaction.findMany.mockResolvedValue([]); });
  it("filtra categorías en /api/transactions", async () => {
    await transactions(new NextRequest("http://localhost/api/transactions"));
    expect(mocks.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ userId: null }, { userId: "alice" }], isArchived: false } }));
  });
  it("filtra también los contadores de categorías base", async () => {
    await categories();
    expect(mocks.category.findMany.mock.calls[0][0].include._count.select.transactions.where.userId).toBe("alice");
  });
  it("pagina y conserva filtros en la consulta de movimientos", async () => {
    await transactions(new NextRequest("http://localhost/api/transactions?page=2&pageSize=25&accountId=own&type=EXPENSE&planningGoalId=__none"));
    expect(mocks.transaction.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 25, take: 25, where: expect.objectContaining({ userId: "alice", accountId: "own", isInternalTransfer: false, amount: { lt: 0 }, planningGoals: { none: {} } }) }));
  });
  it("rechaza modificar una cuenta de Bob", async () => {
    mocks.account.findUnique.mockResolvedValue({ id: "b", userId: "bob" });
    expect((await account(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ name: "Hacked" }) }), { params: Promise.resolve({ id: "b" }) })).status).toBe(404);
    expect(mocks.account.update).not.toHaveBeenCalled();
  });
  it("no busca candidatos de un movimiento ajeno", async () => {
    mocks.transaction.findFirst.mockResolvedValue(null);
    expect((await candidates(new NextRequest("http://localhost?kind=refund"), { params: Promise.resolve({ id: "bob-movement" }) })).status).toBe(404);
    expect(mocks.transaction.findFirst.mock.calls[0][0].where).toEqual({ id: "bob-movement", userId: "alice" });
  });
  it("rechaza userId ajeno aunque se envíe por URL", () => {
    expect(() => getAuthorizedUserId({ id: "alice", role: "USER" } as Parameters<typeof getAuthorizedUserId>[0], "bob")).toThrow();
  });
  it("no devuelve detalles internos de Prisma", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const payload = await jsonError(new Error("postgresql://private-secret@db:5432/finance")).json();
    expect(JSON.stringify(payload)).not.toContain("private-secret");
  });
});
