import { Router, Request, Response, NextFunction } from "express";

export const router = Router();

// Inline authentication check middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any)?.authenticated) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

// -------------------------------------------------------------
// PUBLIC ROUTES
// -------------------------------------------------------------

// Check auth status
router.get("/auth/status", (req, res) => {
  if ((req.session as any)?.authenticated) {
    return res.json({ authenticated: true });
  }
  return res.json({ authenticated: false });
});

// Login
router.post("/login", (req, res) => {
  const { password } = req.body;
  const appPassword = process.env.APP_PASSWORD;

  // Debug logging for Render console
  console.log("Submitted password:", password);
  console.log("APP_PASSWORD set in env:", appPassword ? "YES" : "NO (MISSING)");

  if (password && appPassword && password.trim() === appPassword.trim()) {
    (req.session as any).authenticated = true;
    return req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to save session" });
      }
      return res.json({ success: true });
    });
  }

  return res.status(401).json({ error: "Invalid password" });
});

// Logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// -------------------------------------------------------------
// PROTECTED ROUTES
// -------------------------------------------------------------
router.use(requireAuth);

export default router;
