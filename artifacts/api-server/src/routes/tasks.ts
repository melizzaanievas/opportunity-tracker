import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, tasksTable, opportunitiesTable } from "../db";
import { requireAuth } from "../middlewares/auth";
import {
  ListTasksParams,
  CreateTaskParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// List tasks for an opportunity
router.get("/opportunities/:id/tasks", requireAuth, async (req, res): Promise<void> => {
  const params = ListTasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.opportunityId, params.data.id))
    .orderBy(asc(tasksTable.createdAt));

  res.json(tasks.map((t) => ({ ...t, completed: Boolean(t.completed) })));
});

// Create task
router.post("/opportunities/:id/tasks", requireAuth, async (req, res): Promise<void> => {
  const params = CreateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify opportunity exists
  const [opp] = await db
    .select({ id: opportunitiesTable.id })
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.id, params.data.id));

  if (!opp) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  const now = new Date().toISOString();
  const [task] = await db
    .insert(tasksTable)
    .values({
      opportunityId: params.data.id,
      title: parsed.data.title,
      completed: false,
      createdAt: now,
    })
    .returning();

  res.status(201).json({ ...task, completed: Boolean(task.completed) });
});

// Update task
router.patch("/opportunities/:id/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.completed !== undefined) updates.completed = parsed.data.completed;

  const [updated] = await db
    .update(tasksTable)
    .set(updates)
    .where(
      and(
        eq(tasksTable.id, params.data.taskId),
        eq(tasksTable.opportunityId, params.data.id)
      )
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({ ...updated, completed: Boolean(updated.completed) });
});

// Delete task
router.delete("/opportunities/:id/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(tasksTable)
    .where(
      and(
        eq(tasksTable.id, params.data.taskId),
        eq(tasksTable.opportunityId, params.data.id)
      )
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
