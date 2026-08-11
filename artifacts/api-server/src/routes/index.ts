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
// PUBLIC AUTH ROUTES (Matching frontend endpoints)
// -------------------------------------------------------------

// Check auth status (/api/auth/me)
router.get("/auth/me", (req, res) => {
  if ((req.session as any)?.authenticated) {
    return res.json({ authenticated: true });
  }
  return res.status(401).json({ authenticated: false, error: "Not logged in" });
});

// Login (/api/auth/login)
router.post("/auth/login", (req, res) => {
  const { password } = req.body;
  const appPassword = process.env.APP_PASSWORD;

  if (password && appPassword && password.trim() === appPassword.trim()) {
    (req.session as any).authenticated = true;
    return req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to save session" });
      }
      return res.json({ success: true, authenticated: true });
    });
  }

  return res.status(401).json({ error: "Invalid password" });
});

// Logout (/api/auth/logout)
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// -------------------------------------------------------------
// PROTECTED ROUTES
// -------------------------------------------------------------
router.use(requireAuth);

export default router;
