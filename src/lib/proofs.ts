import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, supportedActions, reviews, verificationAttempts } from "@/db/schema";

export async function loadSupportedAction(projectId: number, chainId: number) {
  const db = getDb();
  const project = (await db.select().from(projects).where(eq(projects.id, projectId)))[0];
  if (!project || project.status !== "supported") return null;
  const action = (
    await db
      .select()
      .from(supportedActions)
      .where(
        and(
          eq(supportedActions.projectId, projectId),
          eq(supportedActions.chainId, chainId),
          eq(supportedActions.enabled, true),
        ),
      )
      .orderBy(desc(supportedActions.version))
      .limit(1)
  )[0];
  if (!action) return null;
  return { project, action };
}

export type BlockCode = "PROOF_ALREADY_USED" | "REVIEW_ALREADY_EXISTS";

/** DB-level reuse guard. Stale prepared rows (past deadline) never block. */
export async function findBlockingReview(args: {
  chainId: number;
  projectId: number;
  reviewer: string;
  proofTxHash: string;
}): Promise<BlockCode | null> {
  const db = getDb();
  const rows = await db
    .select({ status: reviews.status, authDeadline: reviews.authDeadline })
    .from(reviews)
    .where(and(eq(reviews.chainId, args.chainId), eq(reviews.proofTxHash, args.proofTxHash.toLowerCase())));
  const now = new Date();
  const active = rows.filter(
    (r) => r.status === "published" || (r.status === "prepared" && r.authDeadline && r.authDeadline > now),
  );
  if (active.length > 0) return "PROOF_ALREADY_USED";

  const mine = await db
    .select({ status: reviews.status, authDeadline: reviews.authDeadline })
    .from(reviews)
    .where(
      and(
        eq(reviews.projectId, args.projectId),
        eq(reviews.reviewer, args.reviewer.toLowerCase()),
      ),
    );
  const mineActive = mine.filter(
    (r) => r.status === "published" || (r.status === "prepared" && r.authDeadline && r.authDeadline > now),
  );
  if (mineActive.length > 0) return "REVIEW_ALREADY_EXISTS";
  return null;
}

export async function logAttempt(args: {
  wallet: string;
  projectId: number | null;
  txHash: string;
  resultCode: string;
}) {
  await getDb()
    .insert(verificationAttempts)
    .values({ wallet: args.wallet.toLowerCase(), projectId: args.projectId, txHash: args.txHash.toLowerCase(), resultCode: args.resultCode })
    .catch(() => undefined);
}
