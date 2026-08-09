import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import opportunitiesRouter from "./opportunities";
import tasksRouter from "./tasks";
import integrationsRouter from "./integrations";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(opportunitiesRouter);
router.use(tasksRouter);
router.use(integrationsRouter);
router.use(dashboardRouter);

export default router;
