import path from "path";
import fs from "fs";

// ... your Express routes and API handlers above ...

// Serve static frontend assets
const possibleStaticPaths = [
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "artifacts/api-server/dist/public"),
  path.resolve(process.cwd(), "artifacts/opportunity-tracker/dist/public"),
];

const publicPath = possibleStaticPaths.find((p) => fs.existsSync(p)) || possibleStaticPaths[0];

app.use(express.static(publicPath));

// Fallback catch-all route for SPA (Single Page Application)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  const indexPath = path.join(publicPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("index.html not found on server");
  }
});
