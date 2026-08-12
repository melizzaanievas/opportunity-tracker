import { Router, Request, Response, NextFunction } from "express";
import opportunitiesRouter from "./opportunities.js";
import integrationsRouter from "./integrations.js";

export const router = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any)?.authenticated) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

// Public Auth Routes
router.get("/auth/me", (req, res) => {
  if ((req.session as any)?.authenticated) {
    return res.json({ authenticated: true });
  }
  return res.status(401).json({ authenticated: false, error: "Not logged in" });
});

router.post("/auth/login", (req, res) => {
  const { password } = req.body;
  const appPassword = process.env.APP_PASSWORD;

  if (password && appPassword && password.trim() === appPassword.trim()) {
    (req.session as any).authenticated = true;
    return req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Failed to save session" });
      return res.json({ success: true, authenticated: true });
    });
  }

  return res.status(401).json({ error: "Invalid password" });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Protected Routes
router.use(requireAuth);
router.use("/opportunities", opportunitiesRouter);
router.use("/integrations", integrationsRouter);

export default router;
