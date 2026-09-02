# 🎯 Opportunity Tracker & Executive Pipeline Dashboard

A sleek, minimalist, multi-platform opportunity management workspace designed to aggregate, track, and streamline applications across jobs, fellowships, casting calls, grants, and competitions. Built with a unified view-switching engine, automated deliverable extraction, and intelligent scouting integrations.

---

## ✨ Features

* **Unified View Switcher System:**
  * **Grid View:** High-density, customizable cards displaying status, deadlines, and key metadata.
  * **Kanban Board:** Drag-and-drop pipeline stages (`To Apply`, `Applied / Pending`, `Interviewing`, `Offered`, `Archived`).
  * **Calendar View:** Interactive visual timeline tracking upcoming deadlines and submission windows.
  * **Pipeline Analytics:** Dedicated metrics workspace breaking down category distribution without main dashboard clutter.

* **Automated Task & Deliverable Parser:**
  * Scrapes target application links upon saving.
  * Auto-extracts required submission deliverables (e.g., CV/Resume, Cover Letter, Portfolio, Audition Video, Headshot) into actionable checklists.

* **Multi-Platform Scouting Engine:**
  * Automated job/opportunity scouting across LinkedIn, Indeed, X (Twitter), and Google Search via SerpAPI/JSearch.
  * Scheduled Telegram Bot updates delivering daily digests directly to your chat.

* **Interactive Onboarding & Health Diagnostics:**
  * Step-by-step interactive demo tour powered by `driver.js`.
  * Auto-healing Telegram webhook registration to prevent environment URL drift.

---

## 🛠️ Tech Stack

* **Frontend:** React, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Driver.js
* **Backend:** Node.js, Express, Drizzle ORM, PostgreSQL (Supabase / Neon)
* **Integrations:** Telegram Bot API, SerpAPI / JSearch API, ZenQuotes API
* **Deployment:** Node.js / Vercel / Render / Railway

---

## 🚀 Getting Started

### 1. Prerequisites

* **Node.js:** `v18.x` or higher
* **npm:** `v9.x` or higher
* **PostgreSQL Database:** Supabase, Neon, or local instance

### 2. Installation & Setup

Clone the repository and install dependencies:

```bash
git clone [https://github.com/melizzaanievas/opportunity-tracker.git](https://github.com/melizzaanievas/opportunity-tracker.git)
cd opportunity-tracker
npm install
```

### 3. Environment Configuration
Create a .env file in the root directory and populate it based on .env.example:

```text
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/opportunity_db

# Telegram Integration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_SECRET=your_telegram_webhook_secret

# External APIs
SERPAPI_KEY=your_serpapi_key
```

### 4. Database Setup & Migrations
Push the Drizzle ORM schema to your PostgreSQL database:

```bash
npm run db:push
```

5. Running the Application
Start the development server (frontend & backend concurrently):

```bash
npm run dev
```

Open your browser and navigate to http://localhost:5000 (or the port specified in your console).

## 📄 License
This project is licensed under the MIT License.
