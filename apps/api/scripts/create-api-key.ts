// Usage: npm run api-key:create -w @langkahbelajar/api -- <partner-name> [scope ...]
import { PrismaClient } from "@prisma/client";
import { hashToken, newToken } from "../src/contexts/identity/passwords";

const [name, ...scopes] = process.argv.slice(2);
if (!name) throw new Error("A partner name is required");

const prisma = new PrismaClient();
const key = `lb_${newToken()}`;
await prisma.apiClient.create({ data: { name, keyHash: hashToken(key), scopes: scopes.length ? scopes : ["skills:read"] } });
await prisma.$disconnect();
console.log(`API key for ${name} (shown once): ${key}`);
