import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
export async function checkLoginRateLimit(email: string, requestHeaders: Headers, now = Date.now()) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Authentication configuration unavailable");
  const ip = requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const window = Math.floor(now / WINDOW_MS);
  const expiresAt = new Date((window + 1) * WINDOW_MS);
  const buckets = [{ scope: "ip", value: ip, limit: 40 }, { scope: "email", value: email, limit: 10 }];
  const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));
  // Block the IP first: rotating emails must not create unbounded buckets.
  for (const bucket of buckets) {
    const key = createHmac("sha256", secret).update(`${bucket.scope}:${window}:${bucket.value}`).digest("hex");
    const row = await prisma.loginRateLimit.upsert({ where: { key }, create: { key, expiresAt }, update: { attempts: { increment: 1 } } });
    if (row.attempts > bucket.limit) return { allowed: false, retryAfter };
    if (bucket.scope === "ip" && row.attempts === 1) {
      await prisma.loginRateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now - WINDOW_MS) } } });
    }
  }
  return { allowed: true, retryAfter };
}
