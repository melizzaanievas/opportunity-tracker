import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

// Allow cross-origin requests & custom authentication headers
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-passcode"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env.SESSION_SECRET || "supersecretkey1234567890";

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    name: "connect.sid",
    cookie: {
      secure: true,
      sameSite: "none",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// BYPASS COOKIE BLOCKS: If passcode matches APP_PASSWORD, force session authentication
app.use((req, _res, next) => {
  const passcodeHeader = req.headers["x-passcode"] as string;
  const appPassword = process.env.APP_PASSWORD;
  
  if (passcodeHeader && appPassword && passcodeHeader === appPassword) {
    (req.session as any).authenticated = true;
  }
  next();
});

app.use("/api", router);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

export default app;
