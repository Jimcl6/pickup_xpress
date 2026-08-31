import type { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { config } from "./config.js";
import { HttpError } from "./http-error.js";

export const adminCookieName = "px_admin_session";

function scryptAsync(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scryptAsync(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function setAdminCookie(response: Response, token: string, expiresAt: Date) {
  response.cookie(adminCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });
}

export function clearAdminCookie(response: Response) {
  response.clearCookie(adminCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.NODE_ENV === "production",
    path: "/"
  });
}

export async function createAdminSession(
  database: PrismaClient,
  user: { id: string; merchantId: string }
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.SESSION_DAYS * 24 * 60 * 60 * 1000);
  await database.merchantSession.create({
    data: {
      userId: user.id,
      merchantId: user.merchantId,
      tokenHash: hashSessionToken(token),
      expiresAt
    }
  });
  return { token, expiresAt };
}

export async function deleteAdminSession(database: PrismaClient, request: Request) {
  const token = readCookie(request, adminCookieName);
  if (!token) return;
  await database.merchantSession.deleteMany({
    where: { tokenHash: hashSessionToken(token) }
  });
}

export async function requireAdmin(database: PrismaClient, request: Request) {
  const token = readCookie(request, adminCookieName);
  if (!token) throw new HttpError(401, "Please sign in to continue.");

  const session = await database.merchantSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      merchant: { select: { id: true, name: true, slug: true } }
    }
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) await database.merchantSession.delete({ where: { id: session.id } });
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }

  return { user: session.user, merchant: session.merchant };
}
