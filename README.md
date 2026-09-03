# 🚀 Opportunity Tracker & Link Ingestion Hub

An automated, cross-platform **Opportunity Tracker** designed to capture, organize, and manage incoming links, leads, and ideas. 

It connects a lightweight **React (Vite) Frontend** hosted on **Vercel** with a high-performance **Node.js (Express) API Backend** hosted on **Railway**, powered by an automated **Telegram Bot** for instant link ingestion.

---

## 📸 Live Demo & Screenshots

> **Note:** WORK IN PROGRESS

---

## ✨ Features

- **⚡ Instant Link Ingestion:** Share any link or opportunity directly to your dedicated Telegram Bot, and it automatically parses, categorizes, and saves the data.
- **🔒 Passcode Authentication:** Simple, session-based password authorization to keep your links and dashboard private.
- **📊 Opportunity Dashboard:** Clean UI built with React, Tailwind CSS, and Radix UI components for filtering, search, and categorization.
- **🐳 Production-Ready Dockerized Backend:** Pre-configured Docker build pipeline supporting native C++ bindings (`better-sqlite3`, `esbuild`) on lightweight Alpine Linux containers.
- **🔄 Monorepo Architecture:** Clean package isolation using `pnpm` workspaces (`/artifacts/opportunity-tracker` and `/artifacts/api-server`).

---

## 🚀 One-Click Self-Hosting & Deployment

The easiest way to run your own private instance without sharing your personal dashboard URL or incurring heavy maintenance:

### 1. Backend Deployment (Railway)
1. Fork this repository to your GitHub account.
2. Create a new service on [Railway](https://railway.app) and select **Deploy from GitHub repo**.
3. Railway will automatically detect the root `Dockerfile`.
4. Add the following **Environment Variables** in Railway:
   - `APP_PASSWORD`: Your secret passcode for logging in.
   - `SESSION_SECRET`: A long random string for session encryption.
   - `PORT`: `5000`

### 2. Frontend Deployment (Vercel)
1. Import your forked repository into [Vercel](https://vercel.com).
2. Update the root **`vercel.json`** file in your GitHub repo to point `/api` requests to your Railway public domain:
   ```json
   {
     "outputDirectory": "artifacts/opportunity-tracker/dist/public",
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "[https://YOUR-RAILWAY-APP.up.railway.app/api/:path](https://YOUR-RAILWAY-APP.up.railway.app/api/:path)*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
3. Deploy! Vercel will automatically compile the Vite frontend and route authentication calls to Railway.

---

## 💻 Local Development Setup
Ensure you have Node 22 and pnpm installed.

```bash
# Clone the repository
git clone [https://github.com/melizzaanievas/opportunity-tracker.git](https://github.com/melizzaanievas/opportunity-tracker.git)
cd opportunity-tracker

# Install monorepo dependencies
pnpm install

# Start development servers (Frontend + Backend)
pnpm dev
```

## 📄 License
MIT License. Free for personal and commercial use.
