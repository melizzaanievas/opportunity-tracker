import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, preferencesTable } from "../db";
import { requireAuth } from "../middlewares/auth";
import { UpdatePreferencesBody } from "@workspace/api-zod";
import { getScoutPreferences } from "../lib/scout";

const router: IRouter = Router();

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function updatePreferences(req: Request, res: Response): Promise<void> {
  const parsed = UpdatePreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const targetTitles = normalizeList(parsed.data.targetTitles);
  const preferredLocations = normalizeList(parsed.data.preferredLocations);
  const preferredJobTypes = normalizeList(parsed.data.preferredJobTypes);
  const updatedAt = new Date().toISOString();

  await db
    .insert(preferencesTable)
    .values({
      id: 1,
      targetTitles: JSON.stringify(targetTitles),
      preferredLocations: JSON.stringify(preferredLocations),
      preferredJobTypes: JSON.stringify(preferredJobTypes),
      updatedAt,
    })
    .onConflictDoUpdate({
      target: preferencesTable.id,
      set: {
        targetTitles: JSON.stringify(targetTitles),
        preferredLocations: JSON.stringify(preferredLocations),
        preferredJobTypes: JSON.stringify(preferredJobTypes),
        updatedAt,
      },
    });

  res.json(await getScoutPreferences());
}

router.get("/preferences", requireAuth, async (_req, res): Promise<void> => {
  res.json(await getScoutPreferences());
});

router.put("/preferences", requireAuth, updatePreferences);
router.patch("/preferences", requireAuth, updatePreferences);

export default router;