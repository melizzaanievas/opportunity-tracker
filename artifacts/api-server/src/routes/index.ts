import { Router } from "express";
import { requireAuth } from "../auth";

export const router = Router();

// Login endpoint
router.post("/login", (req, res) => {
  const { password } = req.body;
  const appPassword = process.env.APP_PASSWORD;

  if (password === appPassword) {
    (req.session as any).authenticated = true;
    return res.json({ success: true });
  }

  return res.status(401).json({ error: "Invalid password" });
});

// Logout endpoint
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Check auth status endpoint
router.get("/auth/status", (req, res) => {
  if ((req.session as any)?.authenticated) {
    return res.json({ authenticated: true });
  }
  return res.json({ authenticated: false });
});

// Protect remaining API routes below this line
router.use(requireAuth);

// Your protected endpoints (e.g., opportunities, pipeline data, etc.)
// router.get("/opportunities", ...);

export default router;
