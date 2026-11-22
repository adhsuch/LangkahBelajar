import type { SkillCode } from "@langkahbelajar/shared";
import type { Tx } from "../../lib/prisma";

export interface SessionCompleted {
  sessionId: string;
  childId: string;
  completedAt: string;
  skills: { skillCode: SkillCode; completed: number; skipped: number; postponed: number; independent: number; withTaskHelp: number }[];
}

type Handler = (event: SessionCompleted, tx: Tx) => Promise<void>;
const handlers: Handler[] = [];

export const onSessionCompleted = (handler: Handler) => void handlers.push(handler);

// Handlers run in the completing transaction, so a session cannot finish without its read model.
export async function publishSessionCompleted(event: SessionCompleted, tx: Tx) {
  for (const handler of handlers) await handler(event, tx);
}
