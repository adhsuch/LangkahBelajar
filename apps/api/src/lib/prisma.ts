import { Prisma, PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export type Tx = Prisma.TransactionClient;

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
