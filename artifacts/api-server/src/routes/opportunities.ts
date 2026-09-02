import { Router, type IRouter } from "express";
import { eq, asc, and, sql } from "drizzle-orm";
import { db, opportunitiesTable, tasksTable } from "../db";
import { requireAuth } from "../middlewares/auth";
import {
  CreateOpportunityBody,
  UpdateOpportunityBody,
  UpdateOpportunityParams,
  DeleteOpportunityParams,
  GetOpportunityParams,
  ListOpportunitiesQueryParams,
  ScrapeOpportunityUrlBody,
} from "@workspace/api-zod";
import { scrapeUrl, UnsafeScrapeUrlError } from "../lib/scraper";

const router: IRouter = Router();

// List opportunities sorted by deadline, with optional filters
router.get("/opportunities", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListOpportunitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, type } = parsed.data;

  const conditions = [];
  if (status) conditions.push(eq(opportunitiesTable.status, status));
  if (type) conditions.push(eq(opportunitiesTable.type, type));

  const rows = await db
    .select({
      id: opportunitiesTable.id,
      url: opportunitiesTable.url,
      title: opportunitiesTable.title,
      company: opportunitiesTable.company,
      type: opportunitiesTable.type,
      status: opportunitiesTable.status,
      deadline: opportunitiesTable.deadline,
      summary: opportunitiesTable.summary,
      keyActionSteps: opportunitiesTable.keyActionSteps,
      createdAt: opportunitiesTable.createdAt,
      taskCount: sql<number>`(SELECT COUNT(*) FROM tasks WHERE tasks.opportunity_id = ${opportunitiesTable.id})`,
      completedTaskCount: sql<number>`(SELECT COUNT(*) FROM tasks WHERE tasks.opportunity_id = ${opportunitiesTable.id} AND tasks.completed = 1)`,
    })
    .from(opportunitiesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(sql`CASE WHEN ${opportunitiesTable.deadline} IS NULL THEN 1 ELSE 0 END`), asc(opportunitiesTable.deadline));

  res.json(rows);
});

// Create
router.post("/opportunities", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOpportunityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date().toISOString();
  const [opp] = await db
    .insert(opportunitiesTable)
    .values({
      url: parsed.data.url,
      title: parsed.data.title,
      company: parsed.data.company ?? null,
      type: parsed.data.type,
      status: parsed.data.status,
      deadline: parsed.data.deadline ?? null,
      summary: parsed.data.summary ?? null,
      keyActionSteps: parsed.data.keyActionSteps ?? null,
      createdAt: now,
    })
    .returning();

  res.status(201).json({ ...opp, taskCount: 0, completedTaskCount: 0 });
});

// Scrape URL
router.post("/opportunities/scrape", requireAuth, async (req, res): Promise<void> => {
  const parsed = ScrapeOpportunityUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await scrapeUrl(parsed.data.url);
    res.json({ url: parsed.data.url, ...result });
  } catch (err) {
    if (err instanceof UnsafeScrapeUrlError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Get single
router.get("/opportunities/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetOpportunityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const id = params.data.id;
  const [opp] = await db
    .select({
      id: opportunitiesTable.id,
      url: opportunitiesTable.url,
      title: opportunitiesTable.title,
      company: opportunitiesTable.company,
      type: opportunitiesTable.type,
      status: opportunitiesTable.status,
      deadline: opportunitiesTable.deadline,
      summary: opportunitiesTable.summary,
      keyActionSteps: opportunitiesTable.keyActionSteps,
      createdAt: opportunitiesTable.createdAt,
      taskCount: sql<number>`(SELECT COUNT(*) FROM tasks WHERE tasks.opportunity_id = ${opportunitiesTable.id})`,
      completedTaskCount: sql<number>`(SELECT COUNT(*) FROM tasks WHERE tasks.opportunity_id = ${opportunitiesTable.id} AND tasks.completed = 1)`,
    })
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.id, id));

  if (!opp) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  res.json(opp);
});

// Update
router.patch("/opportunities/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOpportunityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOpportunityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = params.data.id;
  const updates: Record<string, unknown> = {};
  if (parsed.data.url !== undefined) updates.url = parsed.data.url;
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.company !== undefined) updates.company = parsed.data.company;
  if (parsed.data.type !== undefined) updates.type = parsed.data.type;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.deadline !== undefined) updates.deadline = parsed.data.deadline;
  if (parsed.data.summary !== undefined) updates.summary = parsed.data.summary;
  if (parsed.data.keyActionSteps !== undefined) updates.keyActionSteps = parsed.data.keyActionSteps;

  const [updated] = await db
    .update(opportunitiesTable)
    .set(updates)
    .where(eq(opportunitiesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  const taskCount = (
    db
      .select({ count: sql<number>`count(*)` })
      .from(tasksTable)
      .where(eq(tasksTable.opportunityId, id))
      .get() as { count: number } | undefined
  )?.count ?? 0;

  const completedTaskCount = (
    db
      .select({ count: sql<number>`count(*)` })
      .from(tasksTable)
      .where(and(eq(tasksTable.opportunityId, id), eq(tasksTable.completed, true)))
      .get() as { count: number } | undefined
  )?.count ?? 0;

  res.json({ ...updated, taskCount, completedTaskCount });
});

// Delete
router.delete("/opportunities/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteOpportunityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(opportunitiesTable)
    .where(eq(opportunitiesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
