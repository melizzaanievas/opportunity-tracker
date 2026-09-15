import { Router } from "express";
import authRouter from "./auth";

const router = Router();

// health and other routes are mounted in the main router; keep this file
// focused for the debug branch.

router.use("/auth", authRouter);

// Dev-only debug endpoint - mounted from the main app when enabled
export default router;
