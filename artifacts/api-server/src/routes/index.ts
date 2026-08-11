import { Router } from "express";
import { requireAuth } from "../auth.js";

export const router = Router();

// Endpoint for checking auth status
router.get("/auth/status", (req, res) => {
  if ((req.session as any)?.authenticated) {
    return res.json({ authenticated: true });
  }
  return res.json({ authenticated: false });
});

// Endpoint for logging in
router.post("/login", (req, res) => {
  const { password } = req.body;
  const appPassword = process.env.APP_PASSWORD;

  if (password && password === appPassword) {
    (req.session as any).authenticated = true;
    return res.json({ success: true });
  }

  return res.status(401).json({ error: "Invalid password" });
});

// Endpoint for logging out
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

export default router;
