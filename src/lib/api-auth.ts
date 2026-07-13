import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { AppError } from "./errors";

/**
 * Public REST API authentication via `Authorization: Bearer airk_...` keys.
 * Only the SHA-256 hash is stored; the plaintext key is shown once at creation.
 */

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateApiKey(): { key: string; hashedKey: string; prefix: string } {
  const key = `airk_${randomBytes(24).toString("hex")}`;
  return { key, hashedKey: hashApiKey(key), prefix: key.slice(0, 10) };
}

/** Resolves the request's Bearer key to an organization or throws 401. */
export async function authenticateApiKey(req: NextRequest): Promise<{ orgId: string }> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!key || !key.startsWith("airk_")) {
    throw new AppError("Missing or malformed API key", 401, "unauthorized");
  }

  const record = await prisma.apiKey.findUnique({
    where: { hashedKey: hashApiKey(key) },
    select: { id: true, organizationId: true, revokedAt: true, expiresAt: true },
  });
  if (!record || record.revokedAt || (record.expiresAt && record.expiresAt < new Date())) {
    throw new AppError("Invalid API key", 401, "unauthorized");
  }

  // Fire-and-forget usage timestamp; not worth blocking the request over
  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { orgId: record.organizationId };
}
