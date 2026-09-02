import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { runJobScout } from "../lib/scout";

const router: IRouter = Router();

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function requireScoutAccess(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.authenticated) {
    next();
    return;
  }

  const configuredSecret =
    process.env.SCOUT_CRON_SECRET ?? process.env.CRON_SECRET;
  const providedSecret = req.get("x-scout-cron-secret");

  if (configuredSecret && providedSecret && secretsMatch(providedSecret, configuredSecret)) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}

router.post("/cron/scout", requireScoutAccess, async (_req, res): Promise<void> => {
  const result = await runJobScout();
  res.status(result.success ? 200 : 409).json(result);
});

export default router;