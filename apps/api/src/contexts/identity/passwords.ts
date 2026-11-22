import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify<string, Buffer, number, { N: number; r: number; p: number; maxmem: number }, Buffer>(scrypt);
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 32, PARAMS);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), expected.length, PARAMS);
  return timingSafeEqual(actual, expected);
}

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
