import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Required so Express respects HTTPS headers from Railway's reverse proxy
app.set("trust proxy", 1);

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

// Enhanced CORS setup allowing cookie exchange across Railway deployments
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like server-to-server or curl) or any Railway app domain
      if (!origin || origin.includes("railway.app") || origin.includes("localhost")) {
        callback(null, origin || true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
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
    proxy: true, // Explicitly tell express-session to trust Railway's proxy
    cookie: {
      secure: process.env.NODE_ENV === "production" ? "auto" : false, // Dynamically match protocol
      sameSite: "lax",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use("/api", router);

// API paths must always receive an API response. Never fall through to a
// browser-rendered frontend 404 page.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

export default app;
