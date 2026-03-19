# Zee Strategic Intelligence Desk

An AI-augmented commercial intelligence tool designed for Zee Entertainment. This system ingests industry news, triages them using local AI (Ollama), and compiles a strategic newsletter using Gemini 2.5 Flash.

## Quick Start

### 1. Prerequisite: Deep Scraper
Navigate to the root and start the OpenClaw service:
\`\`\`bash
node ingestion/openclaw.js
\`\`\`

### 2. Start the Dashboard
Navigate to the dashboard directory and run the dev server:
\`\`\`bash
cd dashboard
npm run dev
\`\`\`

## Tech Stack
- **Frontend:** Next.js 16 (App Router)
- **Database:** SQLite
- **Intelligence:** Google Gemini API & Ollama (Local)
- **Extraction:** Jina Reader API / Puppeteer (OpenClaw)

## Directory Structure
- \`/db\`: Database schemas and local SQLite storage.
- \`/ingestion\`: Scripts for RSS fetching and OpenClaw extraction.
- \`/dashboard\`: Next.js web interface.