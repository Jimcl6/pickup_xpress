import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/admin-auth.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password || password.length < 12) {
  throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.");
}

const prisma = new PrismaClient();

try {
  const result = await prisma.merchantUser.updateMany({
    where: { email },
    data: { passwordHash: await hashPassword(password) }
  });
  if (result.count !== 1) throw new Error(`No merchant user found for ${email}.`);
  await prisma.merchantSession.deleteMany({ where: { user: { email } } });
  console.log(`Password updated and existing sessions revoked for ${email}.`);
} finally {
  await prisma.$disconnect();
}
