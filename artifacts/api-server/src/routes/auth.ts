import { Router, type IRouter } from "express";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    req.log.error("APP_PASSWORD not set");
    res.status(500).json({ error: "Server misconfigured: APP_PASSWORD not set" });
    return;
  }

  if (parsed.data.password !== appPassword) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  req.session.authenticated = true;
  req.session.save((err) => {
    if (err) {
      req.log.error({ err }, "Session save error");
      res.status(500).json({ error: "Session error" });
      return;
    }
    res.json({ authenticated: true });
  });
});

router.post("/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ authenticated: false });
  });
});

router.get("/me", (req, res): void => {
  res.json({ authenticated: !!req.session?.authenticated });
});

export default router;
