#!/bin/bash

# ZEE STRATEGIC INTEL: MORNING RUN AUTOMATION
echo "🌅 Starting Morning Intelligence Run..."

# 1. Clean the old state
echo "🧹 Clearing yesterday's database..."
rm -f db/intel.db

# 2. Rebuild the structure
echo "🏗️ Rebuilding database schema..."
node db/schema.js

# 3. Ingest fresh articles
echo "📡 Fetching global media network updates..."
node ingestion/ingestion.js

# 4. Local AI Triage
echo "🧠 Waking up Ollama for analytical triage..."
node ingestion/triage.js

echo "✅ Morning Run Complete. Launching Dashboard..."

# 5. Open the Dashboard in the background
cd dashboard
npm run dev