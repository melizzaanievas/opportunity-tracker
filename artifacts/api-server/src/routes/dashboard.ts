import { Router, type IRouter } from "express";
import { sql, gte, and, lte, ne } from "drizzle-orm";
import { db, opportunitiesTable } from "../db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysStr = sevenDaysLater.toISOString().slice(0, 10);

  const all = await db.select().from(opportunitiesTable);

  const byStatus = {
    "to-apply": 0,
    applied: 0,
    interviewing: 0,
    offered: 0,
    archived: 0,
  };
  const byType = {
    job: 0,
    grant: 0,
    casting: 0,
    "singing-competition": 0,
    "grant-fellowship": 0,
    other: 0,
  };

  for (const opp of all) {
    const s = opp.status as keyof typeof byStatus;
    if (s in byStatus) byStatus[s]++;
    const t = opp.type as keyof typeof byType;
    if (t in byType) byType[t]++;
  }

  const closingSoon = await db
    .select({ count: sql<number>`count(*)` })
    .from(opportunitiesTable)
    .where(
      and(
        gte(opportunitiesTable.deadline, todayStr),
        lte(opportunitiesTable.deadline, sevenDaysStr),
        ne(opportunitiesTable.status, "archived")
      )
    )
    .get() as { count: number };

  res.json({
    total: all.length,
    closingSoon: closingSoon?.count ?? 0,
    byStatus,
    byType,
  });
});

export default router;
