import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";
import { runPublicDailySummary } from "./routes/integrations";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true if behind HTTPS proxy in prod
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

// Keep the cron endpoint at the Express app level and before all other API
// routing so external cron services never reach a frontend catch-all.
app.get("/cron-daily-summary", runPublicDailySummary);
app.get("/api/cron-daily-summary", runPublicDailySummary);

app.use("/api", router);

// API paths must always receive an API response. Never fall through to a
// browser-rendered frontend 404 page.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});
import express from "express";
import path from "path";
import fs from "fs";

// Serve frontend static files
const staticPath = path.resolve(process.cwd(), "dist/public");
app.use(express.static(staticPath));

// Catch-all route for frontend (SPA)
app.get("*", (req, res) => {
  const indexPath = path.join(staticPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Frontend build not found");
  }
});

export default app;
