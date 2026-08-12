import { Router } from "express";

export const router = Router();

// GET /api/opportunities
router.get("/", async (req, res) => {
  try {
    // Return list of opportunities from DB
    return res.json([]);
  } catch (error) {
    console.error("Error fetching opportunities:", error);
    return res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

// POST /api/opportunities (Create new entry)
router.post("/", async (req, res) => {
  try {
    const { title, organization, url, description, status } = req.body;

    if (!title || !organization) {
      return res.status(400).json({ error: "Title and Organization are required" });
    }

    // Insert opportunity logic into Supabase / DB here
    // Example response structure:
    const newOpportunity = {
      id: Date.now(),
      title,
      organization,
      url: url || "",
      description: description || "",
      status: status || "To Apply",
      created_at: new Date().toISOString()
    };

    return res.status(201).json(newOpportunity);
  } catch (error) {
    console.error("Error creating opportunity:", error);
    return res.status(500).json({ error: "Failed to create opportunity" });
  }
});

// POST /api/opportunities/scrape (Graceful fallback on scraping failure)
router.post("/scrape", async (req, res) => {
  const { url } = req.body;

  try {
    // If you have a scraper utility, call it here
    // If blocked or failed, catch block will handle fallback
    return res.json({
      title: "",
      organization: "",
      description: ""
    });
  } catch (error) {
    console.warn(`Scraping failed for ${url}:`, error);
    // Return empty fields so the user can enter details manually without error popup
    return res.json({
      title: "",
      organization: "",
      description: "",
      warning: "Could not auto-scrape this website. Please fill in details manually."
    });
  }
});

export default router;
